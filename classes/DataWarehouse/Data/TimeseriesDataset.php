<?php

namespace DataWarehouse\Data;

use CCR\DB;

use \DataWarehouse\Query\Timeseries;

use \DataWarehouse\Query\Model\Table;
use \DataWarehouse\Query\Model\TableField;
use \DataWarehouse\Query\Model\Schema;
use \DataWarehouse\Query\Model\WhereCondition;
use \DataWarehouse\Query\Model\OrderBy;

class TimeseriesDataset
{
    protected $query;
    protected $agg_query;

    protected $series_count = null;

    public function __construct(Timeseries $query)
    {
        $this->query = $query;
        $this->agg_query = $query->getAggregateQuery();

    }

    /**
     * Get the ordered list of data series identifiers based on the
     * aggregate query. This is used to order the datasets that are returned
     * from the timeseries query.
     */
    protected function getSeriesIds($limit, $offset)
    {
        $statement = $this->agg_query->getRawStatement($limit, $offset);
        $statement->execute();

        $groupInstance = reset($this->agg_query->getGroupBys());
        $groupIdColumn = $groupInstance->getIdColumnName(true);

        $seriesIds = array();

        while($row = $statement->fetch(\PDO::FETCH_ASSOC, \PDO::FETCH_ORI_NEXT)) {
            $seriesIds[] = "${row[$groupIdColumn]}";
        }

        return $seriesIds;
    }

    /**
     *
     */
    public function getDatasets($data_description, $limit, $offset, $summarize)
    {
        $timeGroup = null;
        $spaceGroup = null;
        $summaryDataset = null;

        foreach ($this->query->getGroupBys() as $name => $groupBy) {
            if ($name === $this->query->getAggregationUnit()->getUnitName()) {
                $timeGroup = $groupBy;
            } else {
                $spaceGroup = $groupBy;
            }
        }

        $statObj = reset($this->query->getStats());
        $seriesIds = $this->getSeriesIds($limit, $offset);

        if (!empty($seriesIds)) {
            if ($summarize && $limit < $this->getUniqueCount()) {
                $summaryDataset = $this->getSummarizedColumn($statObj->getAlias()->__toString(), $spaceGroup->getName(), $this->getUniqueCount() - $limit, $seriesIds, $this->query->getRealmName());
            }

            $this->query->addWhereAndJoin($spaceGroup->getName(), 'IN', $seriesIds);
        }

        $statement = $this->query->getRawStatement();
        $statement->execute();

        $columnTypes = array();
        for ($end = $statement->columnCount(), $i = 0; $i < $end; $i++) {
             $raw_meta = $statement->getColumnMeta($i);
             $columnTypes[$raw_meta['name']] = $raw_meta;
        }

        $dataSets = array();
        foreach ($seriesIds as $seriesId) {
            $dataSets[$seriesId] = null;
        }

        while($row = $statement->fetch(\PDO::FETCH_ASSOC, \PDO::FETCH_ORI_NEXT)) {

            $seriesId = $row[$data_description->group_by . '_id'];
            $dimension = $row[$data_description->group_by . '_name'];

            $dataSet = $dataSets[$seriesId];
            if ($dataSet === null) {
                $dataSet = $dataSets[$seriesId] = new SimpleTimeseriesData($dimension);

                $dataSet->setUnit($statObj->getLabel()); // <- check this is correct
                $dataSet->setStatistic($statObj);
                $dataSet->setGroupName($dimension);
                $dataSet->setGroupId($row[$data_description->group_by . '_id']); // <- check this is correct
            }

            $value_col = $statObj->getAlias()->__toString();

            $start_ts  = $row[$timeGroup->getName() . '_start_ts'];
            $value = SimpleDataset::convertSQLtoPHP(
                $row[$value_col],
                $columnTypes[$value_col]['native_type'],
                $columnTypes[$value_col]['precision']
            );

            $error = 0;
            if (isset($this->query->_stats['sem_' . $statObj->getAlias()])) {
                $error =  SimpleDataset::convertSQLtoPHP(
                    $row['sem_' . $statObj->getAlias()],
                    $columnTypes['sem_' . $statObj->getAlias()]['native_type'],
                    $columnTypes['sem_' . $statObj->getAlias()]['precision']
                );
            }

            $dataSet->addDatum($start_ts, $value, $error);
        }

        $retVal = array_values($dataSets);

        if ($summaryDataset !== null) {
            $retVal[] = $summaryDataset;
        }

        return $retVal;
    }

    protected function getSummaryOperation($stat) {

        $operation = "SUM";

        // Determine operation for summarizing the dataset
        if ( strpos($stat, 'min_') !== false ) {
            $operation = "MIN";

        } elseif ( strpos($stat, 'max_') !== false ) {
            $operation = "MAX";

        } else {
            $useMean
                = strpos($stat, 'avg_') !== false
                || strpos($stat, 'count') !== false
                || strpos($stat, 'utilization') !== false
                || strpos($stat, 'rate') !== false
                || strpos($stat, 'expansion_factor') !== false;

            $operation = $useMean ? "AVG" : "SUM";
        } // if strpos

        return $operation;
    }

    protected function getSummarizedColumn(
        $column_name,
        $where_name,
        $normalizeBy,
        array $whereExcludeArray,
        $realm
    ) {
        // determine the selected time aggregation unit
        $aggunit_name = $this->query->getAggregationUnit()->getUnitName();

        // assign column names for returned data:
        $values_column_name    = $column_name;
        $start_ts_column_name  = $aggunit_name . '_start_ts';

        $query_classname = '\\DataWarehouse\\Query\\' . $realm . '\\Timeseries';
        $q = new $query_classname(
            $aggunit_name,
            $this->query->getStartDate(),
            $this->query->getEndDate(),
            null,
            null,
            array()
        );

        // add the stats
        foreach ($this->query->_stats as $stat_name => $stat) {
            $q->addStat($stat_name);
        }

        // if we have additional parameters:
        $q->cloneParameters($this->query);

        // group on the where clause column, which will be enforced after time agg. unit
        $q->addGroupBy($where_name);

        $q->addWhereAndJoin($where_name, "NOT IN", $whereExcludeArray);


        // perform the summarization right in the database

        // Take AVG, MIN, MAX, or SUM of the column_name, grouped by time aggregation unit
        $statAlias =  $q->_stats[$column_name]->getAlias();
        $operation = $this->getSummaryOperation($statAlias);

        if ($operation === 'AVG') {
            $stmt = "SUM(t.$column_name) / $normalizeBy";
        } else {
            $stmt = "$operation(t.$column_name)";
        }
        switch ($operation) {
            case 'AVG':
                $series_name = "Avg of $normalizeBy Others";
                break;
            case 'MIN':
                $series_name = "Minimum over all $normalizeBy others";
                break;
            case 'MAX':
                $series_name = "Maximum over all $normalizeBy others";
                break;
            default:
                $series_name = "All $normalizeBy Others";
        }

        // set up data object for return
        $dataObject = new \DataWarehouse\Data\SimpleTimeseriesData($series_name);
        $dataObject->setStatistic($q->_stats[$column_name]);
        $dataObject->setUnit($q->_stats[$column_name]->getLabel());

        $query_string = "SELECT t.$start_ts_column_name AS $start_ts_column_name,
                                $stmt AS $column_name "
                        . " FROM ( "
                        .   $q->getQueryString()
                        . " ) t "
                        . " GROUP BY t.$start_ts_column_name";

        $statement = DB::factory($q->_db_profile)->query(
            $query_string,
            array(),
            true
        );
        $statement->execute();

        $columnTypes = array();

        for ($end = $statement->columnCount(), $i = 0; $i < $end; $i++) {
            $raw_meta = $statement->getColumnMeta($i);
            $columnTypes[$raw_meta['name']] = $raw_meta;
        }

        // accumulate the values in a temp variable, then set everything
        $dataValues = array();
        $dataStartTs = array();

        while ( $row = $statement->fetch(\PDO::FETCH_ASSOC, \PDO::FETCH_ORI_NEXT)) {

            $dataStartTs[]  = $row[$start_ts_column_name];

            $dataValues[] = SimpleDataset::convertSQLtoPHP(
                $row[$values_column_name],
                $columnTypes[$values_column_name]['native_type'],
                $columnTypes[$values_column_name]['precision']
            );
        }

        $dataObject->setValues($dataValues );
        $dataObject->setStartTs($dataStartTs);

        // Prevent drilldown from this summarized data series
        // @refer html/gui/js/DrillDownMenu.js
        $dataObject->setGroupId(-99999);
        $dataObject->setGroupName($series_name);

        return $dataObject;
    }

    /**
    * Build a SimpleTimeseriesData object containing the timeseries data.
    */
    public function getTimestamps()
    {
        $dataStartTs = array();

        foreach ($this->query->getTimestamps() as $raw_timetamp) {
            $dataStartTs[] = $raw_timetamp['start_ts'];
        }

        $column_name = $this->query->getAggregationUnit()->getUnitName();

        $timestampsDataObject = new \DataWarehouse\Data\SimpleTimeseriesData(
            $this->query->_group_bys[$column_name]->getLabel()
        );

        $timestampsDataObject->setStartTs($dataStartTs);

        return $timestampsDataObject;
    }

    public function getUniqueCount()
    {
        if ($this->series_count === null) {
            $this->series_count = $this->agg_query->getCount();
        }
        return $this->series_count;
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
            'sort_type' => 'value_asc'
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

        $stat = reset($this->query->getStats());
        $stat_unit  = $stat->getUnit();

        $seriesName = $stat->getLabel();
        if ( $seriesName != $stat_unit && strpos($seriesName, $stat_unit) === false) {
            $seriesName .= ' (' . $stat_unit . ')';
        }
        if (count($this->query->filterParameterDescriptions) > 0) {
            $seriesName .= ' {' . implode(', ', $this->query->filterParameterDescriptions) . '}';
        }

        $dimensions = $this->getSeriesIds(null, null);
        foreach ($dimensions as $dimension) {
            $exportData['headers'][] = "[$dimension] $seriesName";
        }

        $timeData = array();
        $timestamps = array();

        $statement = $this->query->getRawStatement();
        $statement->execute();
        while($row = $statement->fetch(\PDO::FETCH_ASSOC, \PDO::FETCH_ORI_NEXT)) {

            $dimension = $row[$data_description->group_by . '_name'];

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
}
