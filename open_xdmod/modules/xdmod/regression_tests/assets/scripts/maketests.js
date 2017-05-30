/* maketest - script that generates usage explorer test inputs for all
 * Groups in a realm.
 */

/* Configuration settings:
*/
var rolesFile = '/etc/xdmod/roles.json';
var datawarehouseFile = '/etc/xdmod/datawarehouse.json';
var outputDir = './ue_export_csv';
var startIndex = 100;

/*
var referenceRequest = {
    'public_user': 'false',
    'realm': 'Jobs',
    'group_by': 'nodecount',
    'statistic': 'job_count',
    'start_date': '2017-04-01',
    'end_date': '2017-04-30',
    'timeframe_label': 'Previous+month',
    'scale': '1',
    'aggregation_unit': 'Auto',
    'dataset_type': 'aggregate',
    'thumbnail': 'n',
    'query_group': 'tg_usage',
    'display_type': 'h_bar',
    'combine_type': 'stack',
    'limit': '10',
    'offset': '0',
    'log_scale': 'n',
    'show_guide_lines': 'y',
    'show_trend_line': 'n',
    'show_error_bars': 'n',
    'show_aggregate_labels': 'n',
    'show_error_labels': 'n',
    'hide_tooltip': 'false',
    'show_title': 'y',
    'width': '916',
    'height': '484',
    'legend_type': 'bottom_center',
    'font_size': '3',
    'drilldowns': '[object+Object]',
    'resource': '1',
    'format': 'csv',
    'inline': 'n',
    'operation': 'get_data'
    */

var referenceRequest = {
    'public_user': 'undefined',
    'realm': 'Accounts',
    'group_by': 'none',
    'statistic': 'open_account_count',
    'start_date': '2016-05-01',
    'end_date': '2017-05-01',
    'timeframe_label': '2016',
    'scale': '1',
    'aggregation_unit': 'Auto',
    'dataset_type': 'aggregate',
    'thumbnail': 'n',
    'query_group': 'po_usage',
    'display_type': 'line',
    'combine_type': 'side',
    'limit': '10',
    'offset': '0',
    'log_scale': 'n',
    'show_guide_lines': 'y',
    'show_trend_line': 'y',
    'show_percent_alloc': 'n',
    'show_error_bars': 'y',
    'show_aggregate_labels': 'n',
    'show_error_labels': 'n',
    'show_title': 'y',
    'width': '916',
    'height': '484',
    'legend_type': 'bottom_center',
    'font_size': '3',
    'format': 'csv',
    'inline': 'n',
    'operation': 'get_data'
};

var writeTestData = function(testIndex, testData) {

    var fs = require('fs');

    fs.writeFileSync( outputDir + '/' + testIndex + '_request.json', testData);
};

var run = function() {

    var fs = require('fs');
    var roledata = JSON.parse(fs.readFileSync(rolesFile));
    var datawarehousedata = JSON.parse(fs.readFileSync(datawarehouseFile)).realms;

    var testNumber = startIndex; 

    if (roledata.roles.default) {
        for( var j = 0; j < roledata.roles.default.query_descripters.length; j++) {
            var desc = roledata.roles.default.query_descripters[j];

            if( datawarehousedata[ desc.realm ] )
            {
                console.log('Found ', desc.realm);
                var stats = datawarehousedata[ desc.realm ].statistics;
                for(var s=0; s < stats.length; s++ ) {
                    if( stats[s].name == 'weight' || stats[s].visible === false ) {
                        console.log( 'Ignoring ' + desc.realm + ' ' + stats[s].name );
                    } else {

                        referenceRequest.realm = desc.realm;
                        referenceRequest.group_by = desc.group_by;
                        referenceRequest.statistic = stats[s].name;

                        var ref = JSON.stringify(referenceRequest, null, 4);

                        var testName = referenceRequest.realm + ':' + referenceRequest.group_by + ':' + referenceRequest.statistic;
                        writeTestData(testName, ref);

                        testNumber += 1;
                    }
                }
            }
        }
    }
};

run();
