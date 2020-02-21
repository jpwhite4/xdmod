<?php

namespace DataWarehouse\Data;

use CCR\DB;

use \DataWarehouse\Query\Model\Table;
use \DataWarehouse\Query\Model\TableField;
use \DataWarehouse\Query\Model\Schema;
use \DataWarehouse\Query\Model\WhereCondition;
use \DataWarehouse\Query\Model\OrderBy;

class TimeseriesDataset
{
    private $query;

    public function __construct($query)
    {
        $this->query = $query;

    }

    /**
     */
    private function buildDefaultDataDescription()
    {
        $queryGroupByName = 'none';
        foreach ($this->query->getGroupBys() as $groupBy) {
            $groupByName = $groupBy->getName();
            if (
                $groupByName !== 'day'
                && $groupByName !== 'month'
                && $groupByName !== 'quarter'
                && $groupByName !== 'year'
            ) {
                $queryGroupByName = $groupByName;
                break;
            }
        }

        return (object) array(
            'group_by' => $queryGroupByName,
            'metric' => reset($this->query->getStats())->getAlias(),
            'sort_type' => 'values_asc'
        );
    }

    public function export($export_title = 'title')
    {
        $exportData = array(
            'title' => array(
                'title' => $export_title
            ),
            'title2' => array(
                'parameters' => $this->query->roleParameterDescriptions
            ),
            'duration' => array(
                'start' => $this->query->getStartDate(),
                'end'   => $this->query->getEndDate(),
            ),
            'headers' => array(),
            'rows' => array()
        );

        $group_bys = $this->query->getGroupBys();
        $timeGroup = reset($group_bys);

        $exportData['headers'][] = $timeGroup->getLabel();

        $data_description = $this->buildDefaultDataDescription();
        $statement = $this->getStatement($data_description, null, null, false);

        $lastDimension = '';
        $count = 0;

        $stat = reset($this->query->getStats());
        $stat_unit  = $stat->getUnit();
                    
        $seriesName = $stat->getLabel();
        if ( $seriesName != $stat_unit && strpos($seriesName, $stat_unit) === false) {
            $seriesName .= ' (' . $stat_unit . ')';
        }
        if (count($this->query->filterParameterDescriptions) > 0) {
            $seriesName .= ' {' . implode( ', ', $this->_query->filterParameterDescriptions) . '}';
        }

        $lastDimension = -1;
        $timeData = array();
        $dimensions = array();
        $timestamps = array();

        while($row = $statement->fetch(\PDO::FETCH_ASSOC, \PDO::FETCH_ORI_NEXT)) {
            
            $dimension = $row[$data_description->group_by . '_name'];

            if ($dimension !== $lastDimension) {
                $exportData['headers'][] = "[$dimension] $seriesName";
                $lastDimension = $dimension;
                $dimensions[] = $dimension;
            }

            $timeTs = $row[$timeGroup->getName() . '_start_ts'];

            if (!isset($timestamps[$timeTs]) ) {
                $timestamps[$timeTs] = $row[$timeGroup->getName() . '_name'];
                $timeData[$timeTs] = array();
            }

            $timeData[$timeTs][$dimension] = $row[$stat->getAlias()->getName()];
        }

        // Data are returned in time order, but every dimension may not have all timestamps
        // so the timestamps array may not be in time order
        ksort($timestamps);

        foreach ($timestamps as $timeTs => $timeName) {
            $values = array($timeName);

            foreach ($dimensions as $dimension) {
                if (isset($timeData[$timeTs][$dimension])) {
                    $values[] = $timeData[$timeTs][$dimension];
                } else {
                    $values[] = 0;
                }
            }
            $exportData['rows'][] = $values;
        }

        return $exportData;
    }

    public function getStatement($data_description, $limit, $offset, $summarize)
    {
        $pdo = DB::factory($this->query->_db_profile);

        if ($data_description->group_by !== 'none') {
            $query_classname = '\\DataWarehouse\\Query\\' . $this->query->getRealmName() . '\\Aggregate';

            $agg_query = new $query_classname(
                $this->query->getAggregationUnit()->getUnitName(),
                $this->query->getStartDate(),
                $this->query->getEndDate(),
                null,
                null,
                array()
            );
    
            $agg_query->addGroupBy($data_description->group_by);
    
            foreach ($this->query->_stats as $stat_name => $stat) {
                $agg_query->addStat($stat_name);
            }
    
            foreach ($this->query->sortInfo as $sort) {
                $agg_query->addOrderBy(
                    $sort['column_name'], 
                    $sort['direction']
                );
            }

            $agg_query->cloneParameters($this->query);

            $query_string = $agg_query->getQueryString($limit,  $offset);
        
            $grpCls = $agg_query->getGroupBys()[$data_description->group_by];
        
            $tmptablestring = 'CREATE TEMPORARY TABLE dimension_orders SELECT (@row_number := @row_number + 1) AS order_id, ' . $grpCls->getIdColumnName(true) . ' FROM ( ' . $query_string . ' ) x ';
        
            switch ($data_description->sort_type) {
                case 'value_asc':
                    $tmptablestring .= "ORDER BY " . $data_description->metric . ' ASC ';
                    break;
                case 'value_desc':
                    $tmptablestring .= "ORDER BY " . $data_description->metric . ' DESC ';
                    break;
                case 'label_asc':
                    $tmptablestring .= "ORDER BY " . $grpCls->getOrderIdColumnName(true) . ' ASC ';
                    break;
                case 'label_desc':
                    $tmptablestring .= "ORDER BY " . $grpCls->getOrderIdColumnName(true) . ' DESC ';
                    break;
            }

            $pdo->execute('SET @row_number = 0');
            $pdo->execute($tmptablestring);

            //file_put_contents('/tmp/debug.log', var_export($pdo->query('SELECT * FROM dimension_orders'), true) . "\n", FILE_APPEND);

            $tmpTable = new Table(new Schema(''), 'dimension_orders', 'dorders');
            $this->query->addTable($tmpTable);
            $this->query->addWhereCondition(new WhereCondition(new TableField($tmpTable, $grpCls->getIdColumnName(true)), '=', $this->query->getGroups()[$grpCls->getIdColumnName(true)]));
            $this->query->prependOrder(new OrderBy(new TableField($tmpTable, 'order_id'), 'ASC', ''));
        }

        file_put_contents('/tmp/debug.log', $this->query->getQueryString() . "\n", FILE_APPEND);

        $statement = $pdo->query($this->query->getQueryString(), $this->query->pdoparams, true);
        $statement->execute();

        return $statement;
    }

    public function getDimensionOrderTableSql($data_description, $limit, $offset)
    {
        $query_classname = '\\DataWarehouse\\Query\\' . $this->query->getRealmName() . '\\Aggregate';

        $agg_query = new $query_classname(
            $this->query->getAggregationUnit()->getUnitName(),
            $this->query->getStartDate(),
            $this->query->getEndDate(),
            null,
            null,
            array()
        );

        $agg_query->addGroupBy($data_description->group_by);

        foreach ($this->query->_stats as $stat_name => $stat) {
            $agg_query->addStat($stat_name);
        }

        foreach ($this->query->sortInfo as $sort) {
            $agg_query->addOrderBy(
                $sort['column_name'], 
                $sort['direction']
            );
        }

        $agg_query->cloneParameters($this->query);

        $query_string = $agg_query->getQueryString($limit,  $offset);
        
        $grpCls = $agg_query->getGroupBys()[$data_description->group_by];
        
        $tmptablestring = 'CREATE TEMPORARY TABLE dimension_orders SELECT (@row_number := @row_number + 1) AS order_id, ' . $grpCls->getIdColumnName(true) . ' FROM ( ' . $query_string . ' ) x ';
        
        switch ($data_description->sort_type) {
            case 'value_asc':
                $tmptablestring .= "ORDER BY " . $data_description->metric . ' ASC ';
                break;
            case 'value_desc':
                $tmptablestring .= "ORDER BY " . $data_description->metric . ' DESC ';
                break;
            case 'label_asc':
                $tmptablestring .= "ORDER BY " . $grpCls->getOrderIdColumnName(true) . ' ASC ';
                break;
            case 'label_desc':
                $tmptablestring .= "ORDER BY " . $grpCls->getOrderIdColumnName(true) . ' DESC ';
                break;
        }

        // file_put_contents('/tmp/debug.log', $tmptablestring . "\n", FILE_APPEND);

        return $tmptablestring;
    }

}
