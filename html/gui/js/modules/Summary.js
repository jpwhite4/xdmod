/*
 * JavaScript Document
 * @author Amin Ghadersohi
 * @date 2011-Feb-07 (version 1)
 *
 * @author Ryan Gentner
 * @date 2013-Jun-23 (version 2)
 *
 *
 * This class contains functionality for the summary tab of xdmod.
 *
 */
XDMoD.Module.Summary = function (config) {
    XDMoD.Module.Summary.superclass.constructor.call(this, config);
}; // XDMoD.Module.Summary

// ===========================================================================

XDMoD.portalLayout = function (config) {
    this.layout = [];
    this.managedCharts = 0;
    this.nextColumn = 0;

    this.get = function (totalCharts) {
        var nextRow;

        while (totalCharts > this.managedCharts) {
            nextRow = this.layout[this.nextColumn].length;
            this.add(this.managedCharts, nextRow, this.nextColumn);
        }

        while (totalCharts < this.managedCharts) {
            this.remove(this.managedCharts - 1);
        }

        return this.layout;
    };

    this.add = function (chartId, row, column) {
        this.layout[column].splice(row, 0, chartId);
        this.managedCharts++;
        this.nextColumn = (this.nextColumn + 1) % this.layout.length;
    };

    this.remove = function (chartId) {
        var origIndex;

        for (i = 0; i < this.layout.length; i++) {
            origIndex = this.layout[i].indexOf(chartId);
            if (origIndex > -1) {
                this.layout[i].splice(origIndex, 1);
                this.managedCharts--;
                // Need to compute the remainder twice to compute the positive modulo
                this.nextColumn = (((this.nextColumn - 1) % this.layout.length) + this.layout.length) % this.layout.length;
                return;
            }
        }
    };

    this.move = function (chartId, row, column) {
        this.remove(chartId);
        this.add(chartId, row, column);

        return this.layout;
    };

    var i,
        j;
    var nColumns;

    if (typeof config === 'number') {
        nColumns = config;
        for (i = 0; i < nColumns; i++) {
            this.layout[i] = [];
        }
    } else if (Array.isArray(config)) {
        nColumns = config.length;
        for (i = 0; i < nColumns; i++) {
            this.layout[i] = [];
            for (j = 0; j < config[i].length; j++) {
                this.add(config[i][j], j, i);
            }
        }
    } else {
        throw new RangeError('The argument must be either an array or a number of columns');
    }
};

Ext.extend(XDMoD.Module.Summary, XDMoD.PortalModule, {

    module_id: 'summary',

    usesToolbar: true,

    toolbarItems: {

        durationSelector: true

    },

    // ------------------------------------------------------------------

    initComponent: function () {
        var self = this;

        this.public_user = CCR.xdmod.publicUser;

        self.on('role_selection_change', function () {
            self.reload();
        });

        self.on('duration_change', function () {
            self.reload();
        });

        self.on('resize', function () {
            self.reloadPortlets(self.summaryStore);
            self.portal.doLayout();
            self.toolbar.doLayout();
        });

        self.on('activate', self.checkForUpdates);

        this.layoutStore = new Ext.data.JsonStore({
            proxy: new Ext.data.HttpProxy({
                url: XDMoD.REST.url + '/summary/layout'
            }),
            writer: new Ext.data.JsonWriter(),
            autoDestroy: true,
            autoSave: true,
            restful: true,
            root: 'data',
            idProperty: 'recordid',
            fields: ['recordid', 'layout']
        });


        // ----------------------------------------

        this.summaryStore = new CCR.xdmod.CustomJsonStore({

            root: 'data',
            totalProperty: 'totalCount',
            autoDestroy: true,
            autoLoad: false,
            successProperty: 'success',
            messageProperty: 'message',

            fields: [
                'job_count',
                'active_person_count',
                'active_pi_count',
                'total_waitduration_hours',
                'avg_waitduration_hours',
                'total_cpu_hours',
                'avg_cpu_hours',
                'total_su',
                'avg_su',
                'min_processors',
                'max_processors',
                'avg_processors',
                'total_wallduration_hours',
                'avg_wallduration_hours',
                'gateway_job_count',
                'active_allocation_count',
                'active_institution_count',
                'charts'
            ],

            proxy: new Ext.data.HttpProxy({
                method: 'GET',
                url: 'controllers/ui_data/summary3.php'
            })

        }); // this.summaryStore

        // ----------------------------------------

        this.summaryStore.on('exception', function (dp, type, action, opt, response, arg) {
            if (response.success == false) {
                // todo: show a re-login box instead of logout
                Ext.MessageBox.alert(
                    'Error',
                    response.message || 'Unknown Error',
                    function () {
                        // Remove Mask on body after closing error
                        CCR.xdmod.ui.Viewer.getViewer().el.unmask();
                    }
                );

                if (response.message == 'Session Expired') {
                    CCR.xdmod.ui.actionLogout.defer(1000);
                }
            }
        }, this);

        // ----------------------------------------

        this.toolbar = new Ext.Toolbar({
            border: false,
            cls: 'xd-toolbar'
        });

        this.portal = new Ext.ux.Portal({
            region: 'center',
            border: false,
            items: [],
            listeners: {
                drop: function (e) {
                    var layout = self.layoutObj.move(e.panel.index, e.position, e.columnIndex);

                    var layoutRecord = self.layoutStore.getById(layout.length);
                    if (!layoutRecord) {
                        layoutRecord = new self.layoutStore.recordType({
                            layout: layout,
                            recordid: layout.length
                        });
                        self.layoutStore.add(layoutRecord);
                    } else {
                        layoutRecord.set('layout', layout);
                    }
                }
            }
        });

        this.portalPanel = new Ext.Panel({
            tbar: this.toolbar,
            layout: 'fit',
            region: 'center',
            items: [this.portal]
        });

        var quickFilterButton = XDMoD.DataWarehouse.createQuickFilterButton();
        this.quickFilterButton = quickFilterButton;
        var quickFilterButtonStore = quickFilterButton.quickFilterStore;
        quickFilterButtonStore.on('update', self.reload, self);

        var quickFilterToolbar = XDMoD.DataWarehouse.createQuickFilterToolbar(quickFilterButtonStore, {
            items: [
                quickFilterButton
            ]
        });

        this.mainPanel = new Ext.Panel({
            header: false,
            layout: 'border',
            region: 'center',
            title: '<h3>Summary</h3>',

            //    tbar: quickFilterToolbar,
            items: [this.portalPanel]
        });

        Ext.apply(this, {
            items: [this.mainPanel]
        });

        XDMoD.Module.Summary.superclass.initComponent.apply(this, arguments);

        this.mainPanel.on('afterrender', function () {
            var viewer = CCR.xdmod.ui.Viewer.getViewer();
            if (viewer.el) {
                viewer.el.mask('Loading...');
            }

            this.getDurationSelector().disable();

            this.summaryStore.loadStartTime = new Date().getTime();
            this.reload();

            this.summaryStore.on('load', this.updateUsageSummary, this);
        }, this, {
            single: true
        });
    }, // initComponent

    // ------------------------------------------------------------------

    updateUsageSummary: function (store) {
        var viewer = CCR.xdmod.ui.Viewer.getViewer();

        if (viewer.el) {
            viewer.el.mask('Loading...');
        }

        this.getDurationSelector().disable();

        if (store.getCount() <= 0) {
            CCR.xdmod.ui.toastMessage('Load Data', 'No Results');
            return;
        }

        var record = store.getAt(0);

        var keyStyle = {
            marginLeft: '4px',
            marginRight: '4px',
            fontSize: '11px',
            textAlign: 'center'
        };

        var valueStyle = {
            marginLeft: '2px',
            marginRight: '2px',
            textAlign: 'center',
            fontFamily: 'arial,"Times New Roman",Times,serif',
            fontSize: '11px',
            letterSpacing: '0px'
        };

        var summaryFormat = [

            {

                title: 'Activity',
                items: [

                    {
                        title: 'Users',
                        fieldName: 'active_person_count',
                        numberType: 'int',
                        numberFormat: '#,#'
                    }, {
                        title: 'PIs',
                        fieldName: 'active_pi_count',
                        numberType: 'int',
                        numberFormat: '#,#'
                    }, {
                        title: 'Allocations',
                        fieldName: 'active_allocation_count',
                        numberType: 'int',
                        numberFormat: '#,#'
                    }, {
                        title: 'Institutions',
                        fieldName: 'active_institution_count',
                        numberType: 'int',
                        numberFormat: '#,#'
                    }

                ]

            }, // Activity

            {

                title: 'Jobs',
                items: [

                    {
                        title: 'Total',
                        fieldName: 'job_count',
                        numberType: 'int',
                        numberFormat: '#,#'
                    }, {
                        title: 'Gateway',
                        fieldName: 'gateway_job_count',
                        numberType: 'int',
                        numberFormat: '#,#'
                    }

                ]

            }, // Jobs

            {

                title: 'Service (XD SU)',
                items: [

                    {
                        title: 'Total',
                        fieldName: 'total_su',
                        numberType: 'float',
                        numberFormat: '#,#.0'
                    }, {
                        title: 'Avg (Per Job)',
                        fieldName: 'avg_su',
                        numberType: 'float',
                        numberFormat: '#,#.00'
                    }

                ]

            }, // Service (XD SU)

            {

                title: 'CPU Time (h)',
                items: [

                    {
                        title: 'Total',
                        fieldName: 'total_cpu_hours',
                        numberType: 'float',
                        numberFormat: '#,#.0'
                    }, {
                        title: 'Avg (Per Job)',
                        fieldName: 'avg_cpu_hours',
                        numberType: 'float',
                        numberFormat: '#,#.00'
                    }

                ]

            }, // CPU Time (h)

            {

                title: 'Wait Time (h)',
                items: [

                    {
                        title: 'Avg (Per Job)',
                        fieldName: 'avg_waitduration_hours',
                        numberType: 'float',
                        numberFormat: '#,#.00'
                    }

                ]

            }, // Wait Time (h)

            {

                title: 'Wall Time (h)',
                items: [{
                    title: 'Total',
                    fieldName: 'total_wallduration_hours',
                    numberType: 'float',
                    numberFormat: '#,#.0'
                }, {
                    title: 'Avg (Per Job)',
                    fieldName: 'avg_wallduration_hours',
                    numberType: 'float',
                    numberFormat: '#,#.00'
                }]

            }, // Wall Time (h)

            {

                title: 'Processors',
                items: [{
                    title: 'Max',
                    fieldName: 'max_processors',
                    numberType: 'int',
                    numberFormat: '#,#'
                }, {
                    title: 'Avg (Per Job)',
                    fieldName: 'avg_processors',
                    numberType: 'int',
                    numberFormat: '#,#'
                }]

            } // Processors

        ]; // summaryFormat

        this.toolbar.removeAll();

        var activityData = [];
        Ext.each(summaryFormat, function (itemGroup) {
            var itemTitles = [],
                items = [];

            Ext.each(itemGroup.items, function (item) {
                var itemData = record.get(item.fieldName),
                    itemNumber;

                if (itemData) {
                    if (item.numberType === 'int') {
                        itemNumber = parseInt(itemData, 10);
                    } else if (item.numberType === 'float') {
                        itemNumber = parseFloat(itemData);
                    }

                    itemTitles.push({
                        xtype: 'tbtext',
                        text: item.title + ':',
                        style: keyStyle
                    });

                    items.push({
                        xtype: 'tbtext',
                        text: itemNumber.numberFormat(item.numberFormat),
                        style: valueStyle
                    });
                } // if (itemdata)
            }); // Ext.each(itemGroup.items, ...

            if (items.length > 0) {
                // this.toolbar.add({
                activityData.push({
                    xtype: 'buttongroup',
                    columns: items.length,
                    title: itemGroup.title,
                    items: itemTitles.concat(items)
                });
            } // if (items.length > 0)
        }, this); // Ext.each(summaryFormat, …

        this.reloadPortlets(store, activityData);

        this.portal.doLayout();
        this.toolbar.doLayout();
        this.toolbar.hide();

        var viewer = CCR.xdmod.ui.Viewer.getViewer();

        if (viewer.el) {
            viewer.el.unmask();
        }

        this.getDurationSelector().enable();

        var loadTime = (new Date().getTime() - store.loadStartTime) / 1000.0;
        CCR.xdmod.ui.toastMessage('Load Data', 'Complete in ' + loadTime + 's');
    }, // updateUsageSummary

    // ------------------------------------------------------------------
    checkForUpdates: function () {
        if (CCR.xdmod.ui.metricExplorer && CCR.xdmod.ui.metricExplorer.summaryDirty === true) {
            CCR.xdmod.ui.metricExplorer.summaryDirty = false;
            this.reload();
        }
    },

    reload: function () {
        if (!this.getDurationSelector().validate()) {
            return;
        }

        var viewer = CCR.xdmod.ui.Viewer.getViewer();

        if (viewer.el) {
            viewer.el.mask('Processing Query...');
        }

        this.getDurationSelector().disable();

        var startDate = this.getDurationSelector().getStartDate().format('Y-m-d');
        var endDate = this.getDurationSelector().getEndDate().format('Y-m-d');
        var aggregationUnit = this.getDurationSelector().getAggregationUnit();
        var timeframeLabel = this.getDurationSelector().getDurationLabel();

        var filters = {
            data: [],
            total: 0
        };
        this.quickFilterButton.quickFilterStore.each(function (quickFilterRecord) {
            if (!quickFilterRecord.get('checked')) {
                return;
            }

            filters.data.push({
                dimension_id: quickFilterRecord.get('dimensionId'),
                value_id: quickFilterRecord.get('valueId'),
                value_name: quickFilterRecord.get('valueName')
            });
            filters.total++;
        });

        Ext.apply(this.summaryStore.baseParams, {

            start_date: startDate,
            end_date: endDate,
            aggregation_unit: aggregationUnit,
            timeframe_label: timeframeLabel,
            filters: Ext.encode(filters),
            public_user: this.public_user

        });

        this.summaryStore.loadStartTime = new Date().getTime();
        this.summaryStore.removeAll(true);
        this.layoutStore.load({
            callback: function () {
                this.summaryStore.load();
            },
            scope: this
        });
    }, // reload

    // ------------------------------------------------------------------

    reloadPortlets: function (store, activityData) {
        if (store.getCount() <= 0) {
            return;
        }

        this.portal.removeAll(true);

        var portletAspect = 11.0 / 17.0;
        var portletWidth = 580;
        var portletPadding = 25;
        var portalWidth = this.portal.getWidth();
        var portalColumns = [];

        portalColumnsCount = 2; // Math.max(1, Math.round(portalWidth / portletWidth));

        portletWidth = (portalWidth - portletPadding) / portalColumnsCount;

        //	alert(portalColumnsCount+' '+this.portal.getWidth()+' '+portletWidth);
        var scale;
        for (var i = 0; i < portalColumnsCount; i++) {
            if (i % 2 == 0) {
                scale = 1.2;
            } else {
                scale = 0.8;
            }
            var portalColumn = new Ext.ux.PortalColumn({
                width: portletWidth * scale
            });

            portalColumns.push(portalColumn);
            this.portal.add(portalColumn);
        } // for

        var jobEfficiency = function (value, p, record) {
            var getDataColor = function (data) {
                var color = 'gray';
                var steps = [
                    {
                        value: 0.25,
                        color: '#FF0000'
                    },
                    {
                        value: 0.50,
                        color: '#FFB336'
                    },
                    {
                        value: 0.75,
                        color: '#DDDF00'
                    },
                    {
                        value: 1,
                        color: '#50B432'
                    }
                ];

                var i,
                    step;
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

        var formatUserReport = function (value, p, record) {
            return String.format(
                '<div class="userreport"><b>{0}</b><br /><span class="author">Total Jobs: {1} Core Hours: {2}. Efficiency Score {3}%</span></div>',
                value,
                Math.floor(record.data.cpu_hours / 100),
                record.data.cpu_hours,
                record.data.cpu_user * 100
            );
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

        var formatDateWithTimezone = function (value, p, record) {
            return moment(value * 1000).format('Y-MM-DD HH:mm:ss z');
        };

        var charts = Ext.util.JSON.decode(store.getAt(0).get('charts'));

        var getTrackingConfig = function (panel_ref) {
            return {
                title: truncateText(panel_ref.title),
                index: truncateText(panel_ref.config.index),
                start_date: panel_ref.config.start_date,
                end_date: panel_ref.config.end_date,
                timeframe_label: panel_ref.config.timeframe_label
            };
        }; // getTrackingConfig

        var chartPortlets = [];

        for (var i = 0; i < charts.length; i++) {
            var config = charts[i];

            config = Ext.util.JSON.decode(config);
            config.start_date = this.getDurationSelector().getStartDate().format('Y-m-d');
            config.end_date = this.getDurationSelector().getEndDate().format('Y-m-d');
            config.aggregation_unit = this.getDurationSelector().getAggregationUnit();
            config.timeframe_label = this.getDurationSelector().getDurationLabel();
            config.font_size = 2;

            var title = config.title;
            config.title = '';

            this.quickFilterButton.quickFilterStore.each(function (quickFilterRecord) {
                if (!quickFilterRecord.get('checked')) {
                    return;
                }

                var dimensionId = quickFilterRecord.get('dimensionId');
                var valueId = quickFilterRecord.get('valueId');
                var quickFilterId = dimensionId + '=' + valueId;
                var globalFilterExists = false;
                Ext.each(config.global_filters.data, function (globalFilter) {
                    if (quickFilterId === globalFilter.id) {
                        globalFilterExists = true;
                        return false;
                    }
                });
                if (globalFilterExists) {
                    return;
                }

                config.global_filters.data.push({
                    id: quickFilterId,
                    value_id: valueId,
                    value_name: quickFilterRecord.get('valueName'),
                    dimension_id: dimensionId,
                    checked: true
                });
                config.global_filters.total++;
            });

            var portlet = new Ext.ux.Portlet({

                config: config,
                index: i,

                title: (function () {
                    if (title.length > 60) {
                        return title.substring(0, 57) + '...';
                    }
                    return title;
                }()),

                tools: [

                    {
                        id: 'gear',
                        hidden: this.public_user,
                        qtip: 'Edit in Metric Explorer',
                        scope: this,

                        handler: function (event, toolEl, panel, tc) {
                            var trackingConfig = getTrackingConfig(panel);
                            XDMoD.TrackEvent('Summary', 'Clicked On Edit in Metric Explorer tool', Ext.encode(trackingConfig));

                            var config = panel.config;
                            config.font_size = 3;
                            config.title = panel.title;
                            config.featured = true;
                            config.summary_index = (config.preset ? 'summary_' : '') + config.index;

                            XDMoD.Module.MetricExplorer.setConfig(config, config.summary_index, false);
                        } // handler

                    },

                    {
                        id: 'help'
                    }

                ],

                width: portletWidth,
                height: portletWidth * portletAspect,
                layout: 'fit',
                items: [],

                listeners: {

                    collapse: function (panel) {
                        var trackingConfig = getTrackingConfig(panel);
                        XDMoD.TrackEvent('Summary', 'Collapsed Chart Entry', Ext.encode(trackingConfig));
                    }, // collapse

                    expand: function (panel) {
                        var trackingConfig = getTrackingConfig(panel);
                        XDMoD.TrackEvent('Summary', 'Expanded Chart Entry', Ext.encode(trackingConfig));
                    } // expand

                } // listeners

            }); // portlet

            var hcp = new CCR.xdmod.ui.HighChartPanel({

                credits: false,
                chartOptions: {
                    chart: {
                        animation: this.public_user === true
                    },
                    plotOptions: {
                        series: {
                            animation: this.public_user === true
                        }
                    }
                },
                store: new CCR.xdmod.CustomJsonStore({

                    portlet: portlet,

                    listeners: {

                        load: function (store) {
                            var dimensions = store.getAt(0).get('dimensions');
                            var dims = '';
                            for (dimension in dimensions) {
                                dims += '<li><b>' + dimension + ':</b> ' + dimensions[dimension] + '</li>';
                            }
                            var metrics = store.getAt(0).get('metrics');

                            var mets = '';
                            for (metric in metrics) {
                                mets += '<li><b>' + metric + ':</b> ' + metrics[metric] + '</li>';
                            }
                            var help = this.portlet.getTool('help');
                            if (help && help.dom) {
                                help.dom.qtip = '<ul>' + dims + '</ul><hr/>' + '<ul>' + mets + '</ul>';
                            }
                        }, // load

                        exception: function (thisProxy, type, action, options, response, arg) {
                            if (type === 'response') {
                                var data = CCR.safelyDecodeJSONResponse(response) || {};
                                var errorCode = data.code;

                                if (errorCode === XDMoD.Error.QueryUnavailableTimeAggregationUnit) {
                                    var hcp = this.portlet.items.get(0);

                                    var errorMessageExtraData = '';
                                    var errorData = data.errorData;
                                    if (errorData) {
                                        var extraDataLines = [];
                                        if (errorData.realm) {
                                            extraDataLines.push('Realm: ' + Ext.util.Format.htmlEncode(errorData.realm));
                                        }
                                        if (errorData.unit) {
                                            extraDataLines.push('Unavailable Unit: ' + Ext.util.Format.capitalize(Ext.util.Format.htmlEncode(errorData.unit)));
                                        }

                                        for (var i = 0; i < extraDataLines.length; i++) {
                                            if (i > 0) {
                                                errorMessageExtraData += '<br />';
                                            }
                                            errorMessageExtraData += extraDataLines[i];
                                        }
                                    }

                                    hcp.displayError(
                                        'Data not available for the selected aggregation unit.',
                                        errorMessageExtraData
                                    );
                                }
                            }
                        }

                    }, // listeners

                    autoDestroy: true,
                    root: 'data',
                    autoLoad: true,
                    totalProperty: 'totalCount',
                    successProperty: 'success',
                    messageProperty: 'message',

                    fields: [
                        'chart',
                        'credits',
                        'title',
                        'subtitle',
                        'xAxis',
                        'yAxis',
                        'tooltip',
                        'legend',
                        'series',
                        'dimensions',
                        'metrics',
                        'plotOptions',
                        'reportGeneratorMeta'
                    ],

                    baseParams: {
                        operation: 'get_data',
                        showContextMenu: false,
                        config: Ext.util.JSON.encode(config),
                        format: 'hc_jsonstore',
                        public_user: this.public_user,
                        aggregation_unit: this.getDurationSelector().getAggregationUnit(),
                        width: portletWidth,
                        height: portletWidth * portletAspect
                    },

                    proxy: new Ext.data.HttpProxy({
                        method: 'POST',
                        url: 'controllers/metric_explorer.php'
                    })

                }) // store

            }); // hcp

            portlet.add(hcp);
            chartPortlets.push(portlet);
        }

        var mode = 'centerstaff';

        if (mode == 'normaluser') {
            var jobportlet = new Ext.ux.Portlet({
                layout: 'border',
                index: -1,
                width: portletWidth,
                height: portletWidth * portletAspect + 40,
                title: 'Recent Jobs for ' + CCR.xdmod.ui.fullName,
                items: [new Ext.grid.GridPanel({
                    region: 'center',
                    store: new Ext.data.JsonStore({
                        id: 'summary_jobs',
                        proxy: new Ext.data.HttpProxy({
                            api: {
                                read: {
                                    method: 'GET',
                                    url: XDMoD.REST.url + '/warehouse/search/jobs'
                                }
                            }
                        }),
                        root: 'results',
                        autoLoad: true,
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
                    }),
                    colModel: new Ext.grid.ColumnModel({
                        defaults: {
                            sortable: true
                        },
                        columns: [
                            {
                                header: 'Job',
                                renderer: formatJobInfo,
                                width: 250,
                                sortable: true,
                                dataIndex: 'text'
                            },
                            {
                                header: 'Efficiency',
                                renderer: jobEfficiency,
                                width: 35,
                                sortable: true,
                                dataIndex: 'cpu_user'
                            },
                            {
                                header: 'End Time',
                                renderer: formatDateWithTimezone,
                                width: 70,
                                sortable: true,
                                dataIndex: 'end_time_ts'
                            }
                        ]
                    }),
                    viewConfig: {
                        forceFit: true
                    },
                    sm: new Ext.grid.RowSelectionModel({ singleSelect: true }),
                    listeners: {
                        rowclick: function (panel, rowIndex) {
                            var store = panel.getStore();
                            var info = store.getAt(rowIndex);

                            var params = {
                                action: 'show',
                                realm: store.baseParams.realm,
                                jobref: info.data[info.data.dtype]
                            };
                            console.log(params, Ext.urlEncode(params));
                            Ext.History.add('job_viewer?' + Ext.urlEncode(params));
                        }
                    }
                })]
            });

            var allocationPortlet = new Ext.ux.Portlet({
                layout: 'border',
                index: -1,
                width: portletWidth,
                height: portletWidth * portletAspect / 2,
                title: 'Allocation Information for ' + CCR.xdmod.ui.fullName,
                items: [{
                    xtype: 'panel',
                    region: 'center',
                    style: {
                        'text-align': 'center'
                    },
                    html: '<img src="gui/images/AllocationsSmall.png" width="85%" />'
                }]
            });

            var userReport = activityData.splice(0, 5);
            userReport.push({
                xtype: 'panel',
                colspan: 6,
                style: {
                    'text-align': 'right'
                },
                html: '<img src="gui/images/Gauge.png" width="200px" />'
            });
            var userReportPortlet = new Ext.ux.Portlet({
                layout: 'table',
                layoutConfig: {
                    columns: 6
                },
                index: -1,
                width: portletWidth,
                height: portletWidth * portletAspect / 2 + 30,
                title: 'Efficiency Report for ' + CCR.xdmod.ui.fullName,
                items: userReport
            });

            if (CCR.xdmod.ui.fullName) {
                jobportlet.index = chartPortlets.length;
                chartPortlets.push(jobportlet);

                allocationPortlet.index = chartPortlets.length;
                chartPortlets.push(allocationPortlet);

                userReportPortlet.index = chartPortlets.length;
                chartPortlets.push(userReportPortlet);
            }
        }

        if (mode == 'centerstaff') {

            var allUserReportPortlet = new Ext.ux.Portlet({
                layout: 'border',
                index: -1,
                width: portletWidth,
                height: portletWidth * portletAspect + 40,
                title: 'User Report for fictional characters from the Australian soap \'Neighbours\'',
                items: [new Ext.grid.GridPanel({
                    region: 'center',
                    store: new Ext.data.ArrayStore({
                        storeId: 'userreports',
                        fields: [
                            'name',
                            'cpu_hours',
                            'cpu_user'
                        ],
                        data: [
                            [ 'Paul Robinson', 133308, 0.4 ],
                            [ 'Bouncer', 3140, 0.67 ],
                            [ 'Clive Gibbons', 3440, 0.9 ],
                            [ 'Beth Brennan', 3440, 0.9 ],
                            [ 'Toadfish Rebecchi', 3440, 0.9 ],
                            [ 'Helen Daniels', 3440, 0.9 ],
                            [ 'Harold Bishop', 3440, 0.9 ],
                            [ 'Serendipity Gottlieb', 3440, 0.9 ],
                            [ 'Charlene Robinson', 2342323, 0.1 ],
                            [ 'Shane Ramsay', 3440, 0.9 ],
                            [ 'Lucy Robinson', 3440, 0.9 ],
                            [ 'Nell Mangel', 3440, 0.9 ],
                        ]
                    }),
                    colModel: new Ext.grid.ColumnModel({
                        defaults: {
                            sortable: true
                        },
                        columns: [
                            {
                                header: 'User',
                                width: 250,
                                sortable: true,
                                renderer: formatUserReport,
                                dataIndex: 'name'
                            },
                            {
                                header: 'Usage',
                                width: 70,
                                sortable: true,
                                dataIndex: 'cpu_hours'
                            },
                            {
                                header: 'Efficiency',
                                width: 70,
                                renderer: jobEfficiency,
                                sortable: true,
                                dataIndex: 'cpu_user'
                            }
                        ]
                    }),
                    viewConfig: {
                        forceFit: true
                    }
                })]
            });

            if (CCR.xdmod.ui.fullName) {
                allUserReportPortlet.index = chartPortlets.length;
                chartPortlets.push(allUserReportPortlet);
            }
        }

        var layoutRecord = this.layoutStore.getById(portalColumnsCount);

        if (layoutRecord) {
            this.layoutObj = new XDMoD.portalLayout(layoutRecord.get('layout'));
        } else {
            this.layoutObj = new XDMoD.portalLayout(portalColumnsCount);
        }

        var layout = this.layoutObj.get(chartPortlets.length);

        var column;
        var row;
        for (column = 0; column < layout.length; column++) {
            for (row = 0; row < layout[column].length; row++) {
                portalColumns[column].add(chartPortlets[layout[column][row]]);
            }
        }
    } // reloadPortlets

}); // XDMoD.Module.Summary
