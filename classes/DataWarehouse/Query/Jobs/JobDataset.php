<?php
namespace DataWarehouse\Query\SUPREMM;

use \DataWarehouse\Query\Model\Table;
use \DataWarehouse\Query\Model\TableField;
use \DataWarehouse\Query\Model\Field;
use \DataWarehouse\Query\Model\FormulaField;
use \DataWarehouse\Query\Model\WhereCondition;
use \DataWarehouse\Query\Model\Schema;

/*
* @author Joe White
* @date 2015-03-25
*
*/
class JobDataset extends \DataWarehouse\Query\RawQuery
{
    private $sconf = null;
    private $documentation = array();

    public function __construct(
        array $parameters,
        $stat = "all"
    ) {
    
        parent::__construct('Jobs', 'modw', 'job_tasks', $parameters);

        $config = \Xdmod\Config::factory();
        $this->sconf = $config['rawstatisticsconfig'];

        $dataTable = $this->getDataTable();

        if ($stat == "accounting") {
            $i = 0;
            foreach ($this->sconf["modw.job_tasks"] as $sdata) {
                $sfield = $sdata['key'];
                if ($sdata['dtype'] == "accounting") {
                    $this->addField(new TableField($dataTable, $sfield));
                    $this->documentation[$sfield] = $sdata;
                } elseif ($sdata['dtype'] == "foreignkey") {
                    if (isset($sdata['join'])) {
                        $info = $sdata['join'];
                        $i += 1;
                        $tmptable = new Table(new Schema($info['schema']), $info['table'], "ft$i");
                        $this->addTable($tmptable);
                        $this->addWhereCondition(new WhereCondition(new TableField($dataTable, $sfield), '=', new TableField($tmptable, "id")));
                        $fcol = isset($info['column']) ? $info['column'] : 'name';
                        $this->addField(new TableField($tmptable, $fcol, $sdata['name']));

                        $this->documentation[ $sdata['name'] ] = $sdata;
                    }
                }
            }
            $rf = new Table(new Schema('modw'), 'resourcefact', 'rf');
            $this->addTable($rf);
            $this->addWhereCondition(new WhereCondition(new TableField($dataTable, 'resource_id'), '=', new TableField($rf, 'id')));
            $this->addField(new TableField($rf, 'timezone'));
            $this->documentation['timezone'] = array(
                "name" => "Timezone",
                "documentation" => "The timezone of the resource.",
                "group" => "Administration",
                'visibility' => 'public',
                "per" => "resource");
        }
        else
        {
            $this->addField(new TableField($dataTable, "_id", "jobid"));
            $this->addField(new TableField($dataTable, "local_job_id"));

            $rt = new Table(new Schema("modw"), "resourcefact", "rf");
            $this->joinTo($rt, "resource_id", "code", "resource");

            $pt = new Table(new Schema('modw'), 'person', 'p');
            $this->joinTo($pt, "person_id", "long_name", "name");

            $st = new Table(new Schema('modw'), 'systemaccount', 'sa');
            $this->joinTo($st, "systemaccount_id", "username", "username");
        }
    }

    private function joinTo($othertable, $joinkey, $otherkey, $colalias, $idcol = "id")
    {
        $this->addTable($othertable);
        $this->addWhereCondition(new WhereCondition(new TableField($this->getDataTable(), $joinkey), '=', new TableField($othertable, $idcol)));
        $this->addField(new TableField($othertable, $otherkey, $colalias));
    }

    public function getColumnDocumentation()
    {
        return $this->documentation;
    }
}
