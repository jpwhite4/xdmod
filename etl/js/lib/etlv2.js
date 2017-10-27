#!/usr/bin/env nodejs

var sqlType = require('./mysql.js').sqlType;

/*
 * etlv2 uses a different substitution syntax for the various time period variables.
 * This function changes the substitution variables appropriately.
 */
var remapSql = function (sql) {
    var m;
    var map = {
        ':period_start_ts': '${:PERIOD_START_TS}',
        ':period_end_ts': '${:PERIOD_END_TS}',
        ':period_id': '${:PERIOD_ID}',
        ':year': '${:YEAR_VALUE}',
        ':period': '${:PERIOD_VALUE}',
        ':seconds': '${:PERIOD_SECONDS}'
    };

    var output = sql;
    for (m in map) {
        if (map.hasOwnProperty(m)) {
            output = output.replace(new RegExp(m, 'g'), map[m]);
        }
    }

    return output;
};

module.exports = {
    createETLv2Config: function (profile) {
    },
    generateMainConfig: function (profile) {
        /*
        var main = {
            "supremm-realm": [
            {
                "name": "SupremmJobRecordAggregator",
                "namespace": "ETL\\Aggregator",
                "options_class": "AggregatorOptions",
                "class": "SimpleAggregator",
                "description": "Aggregate HPC job records",
                "definition_file": "supremm/supremmfact_hpc_aggregation.json",
                "enabled": true,
                "truncate_destination": false,
                "table_prefix": "supremmfact_by_",
                "exclude_resource_codes": [],
                "aggregation_units": ["day", "month", "quarter", "year"],
                "endpoints": {
                    "source": {
                        "type": "mysql",
                        "name": "SUPReMM DB",
                        "config": "datawarehouse",
                        "schema": "modw_supremm"
                    },
                    "destination": {
                        "type": "mysql",
                        "name": "modw_aggregates",
                        "config": "datawarehouse",
                        "schema": "modw_aggregates",
                        "create_schema_if_not_exists": true
                    }
                }
            }
            ]
        };

        return {
        */
    },
    generateAggregates: function (profile) {
        var table;
        var tableColumns;
        var i;
        var t;

        var aggConf = {
            table_definition: {
            }
        };

        var tables = profile.getAggregationTables();

        for (t in tables) {
            if (tables.hasOwnProperty(t)) {
                table = tables[t];
                tableColumns = tables[t].getAggregationTableFields();
                profile.emit('message', 'Processing table: ' + table.schema + '.' + table.name);

                aggConf.table_definition.name = table.name + '_by_';
                aggConf.table_definition.table_prefix = table.name + '_by_';
                aggConf.table_definition.engine = 'MyISAM';
                aggConf.table_definition.comment = table.name + ' aggregated by ${AGGREGATION_UNIT}.';

                aggConf.table_definition.columns = [
                    {
                        name: '${AGGREGATION_UNIT}_id',
                        type: 'int(10) unsigned',
                        nullable: false,
                        comment: 'DIMENSION: The id related to modw.${AGGREGATION_UNIT}s.'
                    },
                    {
                        name: 'year',
                        type: 'smallint(5) unsigned',
                        nullable: false,
                        comment: 'DIMENSION: The year of the ${AGGREGATION_UNIT}'
                    },
                    {
                        name: '${AGGREGATION_UNIT}',
                        type: 'smallint(5) unsigned',
                        nullable: false,
                        comment: 'DIMENSION: The ${AGGREGATION_UNIT} of the year.'
                    }
                ];
                aggConf.table_definition.indexes = [
                    {
                        name: 'index_' + table.name + '_by_${AGGREGATION_UNIT}_${AGGREGATION_UNIT}_id',
                        columns: ['${AGGREGATION_UNIT}_id']
                    },
                    {
                        name: 'index_' + table.name + '_by_${AGGREGATION_UNIT}_${AGGREGATION_UNIT}',
                        columns: ['${AGGREGATION_UNIT}']
                    }
                ];
                var records = {
                    '${AGGREGATION_UNIT}_id': '${:PERIOD_ID}',
                    year: '${:YEAR_VALUE}',
                    '${AGGREGATION_UNIT}': '${:PERIOD_VALUE}'
                };
                var groupby = [];

                for (i = 0; i < tableColumns.length; ++i) {
                    aggConf.table_definition.columns.push({
                        name: tableColumns[i].name,
                        type: sqlType(tableColumns[i].type, tableColumns[i].length),
                        nullable: !tableColumns[i].dimension,
                        comment: (tableColumns[i].dimension ? 'DIMENSION: ' : 'FACT: ') + tableColumns[i].comments
                    });
                    if (tableColumns[i].dimension) {
                        aggConf.table_definition.indexes.push({
                            name: 'index_' + table.name + '_' + tableColumns[i].name,
                            columns: [tableColumns[i].name]
                        });
                        groupby.push(tableColumns[i].name);
                    }
                    records[tableColumns[i].name] = remapSql(tableColumns[i].sql);
                }

                aggConf.aggregation_period_query = {
                    overseer_restrictions: {
                        last_modified_start_date: 'last_modified >= ${VALUE}',
                        last_modified_end_date: 'last_modified <= ${VALUE}',
                        include_only_resource_codes: 'resource_id IN ${VALUE}',
                        exclude_resource_codes: 'resource_id NOT IN ${VALUE}'
                    },
                    conversions: {
                        start_day_id: 'YEAR(FROM_UNIXTIME(start_time_ts)) * 100000 + DAYOFYEAR(FROM_UNIXTIME(start_time_ts))',
                        end_day_id: 'YEAR(FROM_UNIXTIME(end_time_ts)) * 100000 + DAYOFYEAR(FROM_UNIXTIME(end_time_ts))'
                    }
                };

                aggConf.destination_query = {
                    overseer_restrictions: {
                        include_only_resource_codes: 'record_resource_id IN ${VALUE}',
                        exclude_resource_codes: 'record_resource_id NOT IN ${VALUE}'
                    }
                };

                aggConf.source_query = {
                    overseer_restrictions: {
                        include_only_resource_codes: 'record.resource_id IN ${VALUE}',
                        exclude_resource_codes: 'record.resource_id NOT IN ${VALUE}'
                    },
                    query_hint: 'SQL_NO_CACHE',
                    records: records,
                    groupby: groupby,
                    joins: [{
                        name: 'job',
                        schema: '${SOURCE_SCHEMA}',
                        alias: 'jf'
                    }],
                    where: [
                        'YEAR(FROM_UNIXTIME(jf.start_time_ts)) * 100000 + DAYOFYEAR(FROM_UNIXTIME(jf.start_time_ts)) <= ${:PERIOD_END_DAY_ID} AND YEAR(FROM_UNIXTIME(jf.end_time_ts)) * 100000 + DAYOFYEAR(FROM_UNIXTIME(jf.end_time_ts)) >= ${:PERIOD_START_DAY_ID}'
                    ]
                };
            }
        }

        return aggConf;
    }
};
