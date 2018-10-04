/* global moment */
/**
 * XDMoD.Modules.SummaryPortlets.JobPortlet
 *
 */

Ext.namespace('XDMoD.Modules.SummaryPortlets');

XDMoD.Modules.SummaryPortlets.JobPortlet = Ext.extend(Ext.ux.Portlet, {

    layout: 'border',
    title: 'Recent Jobs for ' + CCR.xdmod.ui.fullName,

    initComponent: function () {
        var formatDateWithTimezone = function (value, p, record) {
            return moment(value * 1000).format('Y-MM-DD HH:mm:ss z');
        };

        var formatJobInfo = function (value, p, record) {
            return String.format(
                '<div class="topic"><b>{0}</b><br /><span class="author">Started: {1} Ended: {2}. CPU Usage {3}%</span></div>',
                value,
                moment(1000 * record.data.start_time_ts).format('Y-MM-DD HH:mm:ss z'),
                moment(1000 * record.data.end_time_ts).format('Y-MM-DD HH:mm:ss z'),
                (record.data.cpu_user * 100.0).toFixed(1)
            );
        };

        var formatJobEff = function (value, p, record) {
            var getDataColor = function (data) {
                var color = 'gray';
                var steps = [{
                    value: 0.25,
                    color: '#FF0000'
                }, {
                    value: 0.50,
                    color: '#FFB336'
                }, {
                    value: 0.75,
                    color: '#DDDF00'
                }, {
                    value: 1,
                    color: '#50B432'
                }];

                var i;
                var step;
                for (i = 0; i < steps.length; i++) {
                    step = steps[i];
                    if (data <= step.value) {
                        color = step.color;
                        break;
                    }
                }
                return color;
            };

            return String.format('<div class="circle" style="background-color: {0}"></div>', getDataColor(record.data.cpu_user));
        };

        this.jobStore = new Ext.data.JsonStore({
            proxy: new Ext.data.HttpProxy({
                api: {
                    read: {
                        method: 'GET',
                        url: XDMoD.REST.url + '/warehouse/search/jobs'
                    }
                }
            }),
            root: 'results',
            autoLoad: false,
            totalProperty: 'totalCount',
            baseParams: {
                start_date: '2018-01-01',
                end_date: '2018-01-07',
                realm: 'SUPREMM',
                limit: 20,
                start: 0,
                verbose: true,
                params: JSON.stringify({
                    person: [
                        CCR.xdmod.ui.mappedPID
                    ]
                })
            },
            fields: [
                { name: 'dtype', mapping: 'dtype', type: 'string' },
                { name: 'resource', mapping: 'resource', type: 'string' },
                { name: 'name', mapping: 'name', type: 'string' },
                { name: 'jobid', mapping: 'jobid', type: 'int' },
                { name: 'local_job_id', mapping: 'local_job_id', type: 'int' },
                { name: 'text', mapping: 'text', type: 'string' },
                'cpu_user',
                'start_time_ts',
                'end_time_ts'
            ]
        });

        this.items = [{
            xtype: 'grid',
            region: 'center',
            store: this.jobStore,
            loadMask: true,
            colModel: new Ext.grid.ColumnModel({
                defaults: {
                    sortable: true
                },
                columns: [{
                    header: 'Job',
                    renderer: formatJobInfo,
                    width: 250,
                    sortable: true,
                    dataIndex: 'text'
                }, {
                    header: 'Efficiency',
                    renderer: formatJobEff,
                    width: 35,
                    sortable: true,
                    dataIndex: 'cpu_user'
                }, {
                    header: 'End Time',
                    renderer: formatDateWithTimezone,
                    width: 70,
                    sortable: true,
                    dataIndex: 'end_time_ts'
                }]
            }),
            viewConfig: {
                forceFit: true
            },
            sm: new Ext.grid.RowSelectionModel({
                singleSelect: true
            }),
            listeners: {
                rowclick: function (panel, rowIndex) {
                    var store = panel.getStore();
                    var info = store.getAt(rowIndex);
                    var params = {
                        action: 'show',
                        realm: store.baseParams.realm,
                        jobref: info.data[info.data.dtype]
                    };
                    Ext.History.add('job_viewer?' + Ext.urlEncode(params));
                }
            }
        }];

        XDMoD.Modules.SummaryPortlets.JobPortlet.superclass.initComponent.apply(this, arguments);
    },

    listeners: {
        reload: function () {
            // TODO
        },
        duration_change: function (timeframe) {
            this.jobStore.load({
                params: {
                    start_date: timeframe.start_date,
                    end_date: timeframe.end_date
                }
            });
        }
    }
});

