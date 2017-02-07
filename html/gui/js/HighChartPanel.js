/*
 * JavaScript Document
 * @author Amin Ghadersohi
 * @date 2012-Mar-07 (version 1)
 *
 * @author Ryan Gentner
 * @date 2013-Jun-23 (version 2)
 *
 *
 * Component for integrating with high charts api
 */
CCR.xdmod.ui.HighChartPanel = function (config) {
    CCR.xdmod.ui.HighChartPanel.superclass.constructor.call(this, config);
}; // CCR.xdmod.ui.HighChartPanel


// Set options globally for all charts instantiated afterwards: 
Highcharts.setOptions ({
    lang: {
        // commas for thousands separators
        thousandsSep: '\u002c' // the humble comma
    }
});

Ext.extend(CCR.xdmod.ui.HighChartPanel, Ext.Panel, {
    credits: true,
    isEmpty: true,

    chartOptions: {},

    initComponent: function () {
        Ext.apply(this, {
            layout: 'fit'
        });
        CCR.xdmod.ui.HighChartPanel.superclass.initComponent.apply(this, arguments);

        var self = this;

        this.baseChartOptions = {
            chart: {
                renderTo: this.id,
                width: this.width,
                height: this.height,
                animation: false,
                events: {

                    selection: function (event) {
                        self.fireEvent('timeseries_zoom', event);
                    }
                }
            },
            plotOptions: {
              series: {
                animation: false,
                turboThreshold: 0
              }
            },
            title: '',
            loading: {
                labelStyle: {
                    top: '45%'
                }
            },
            exporting: {
                enabled: false
            },
            credits: {
                enabled: true
            }
        };

        this.on('render', function () {
            this.initNewChart.call(this);

            this.on('resize', function (t, adjWidth, adjHeight, rawWidth, rawHeight) {
                if (this.chart) {
                    this.chart.setSize(adjWidth, adjHeight);
                }
                this.baseChartOptions.chart.width = adjWidth;
                this.baseChartOptions.chart.height = adjHeight;
            });

            if (this.store) {
                this.store.on('load', function (t, records, options) {
                    if (t.getCount() <= 0) {
                        return;
                    }
                    this.chartOptions = jQuery.extend(true, {}, this.baseChartOptions, t.getAt(0).data);

                    this.chartOptions.exporting.enabled = (this.exporting === true);
                    this.chartOptions.credits.enabled = (this.credits === true);

                    this.chartOptions.title.text = this.highChartsTextEncode(this.chartOptions.title.text);
                    this.isEmpty = this.chartOptions.series && this.chartOptions.series.length === 0;

                    this.initNewChart.call(this);
                    if (this.isEmpty) {
                        var ch_width = this.chartOptions.chart.width * 0.8;
                        var ch_height = this.chartOptions.chart.height * 0.8;

                        this.chart.renderer.image('gui/images/report_thumbnail_no_data.png', 53, 30, ch_width, ch_height).add();
                    }

                }, this);
            }

        }, this, {
            single: true
        });

        this.addEvents("timeseries_zoom");
    },

    /**
     * Instantiates a new chart, optionally with given parameters instead of
     * the settings stored in this panel's configuration.
     *
     * @param  {Object} chartOptions (Optional) A set of HighCharts options.
     */
    initNewChart: function (chartOptions) {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        var finalChartOptions = {
            chart: {
                events: {
                    titleClick: function(event){
                        return XDMoD.Module.MetricExplorer.titleContextMenu(event);
                    },
                    subtitleClick: function(event){
                        return XDMoD.Module.MetricExplorer.subtitleContextMenu(event);
                    },
                    xAxisClick: function(axis){
                        return XDMoD.Module.MetricExplorer.xAxisContextMenu(axis);
                    },
                    yAxisClick: function(axis){
                        return XDMoD.Module.MetricExplorer.yAxisContextMenu(axis);
                    },
                    xAxisTitleClick: function(axis){
                        return XDMoD.Module.MetricExplorer.xAxisTitleContextMenu(axis);
                    },
                    yAxisTitleClick: function(axis){
                        return XDMoD.Module.MetricExplorer.yAxisTitleContextMenu(axis);
                    },
                    xAxisLabelClick: function(axis){
                        return XDMoD.Module.MetricExplorer.xAxisLabelContextMenu(axis);
                    },
                    yAxisLabelClick: function(axis){
                        return XDMoD.Module.MetricExplorer.yAxisLabelContextMenu(axis);
                    },
                    click: function(event){
                        return XDMoD.Module.MetricExplorer.chartContextMenu.call(this,event);
                    },
                    load: function () {
                        var eventHandlers = this.options.chart.events.loadHandlers;
                        if (!eventHandlers) {
                            return;
                        }
                        for (var i = 0; i < eventHandlers.length; i++) {
                            eventHandlers[i].apply(this, arguments);
                        }
                    },
                    redraw: function () {
                        var eventHandlers = this.options.chart.events.redrawHandlers;
                        if (!eventHandlers) {
                            return;
                        }
                        for (var i = 0; i < eventHandlers.length; i++) {
                            eventHandlers[i].apply(this, arguments);
                        }
                    },
                    helperFunctions: {
                        addBackgroundColor: function (element, color) {
                            var xPadding = 3;
                            var yPadding = 2;
                            var rectCornerRadius = 1;

                            var elementBBox = element.getBBox();
                            return element.renderer.rect(
                                    elementBBox.x - xPadding,
                                    elementBBox.y - yPadding,
                                    elementBBox.width + (xPadding * 2),
                                    elementBBox.height + (yPadding * 2),
                                    rectCornerRadius
                                    ).attr({
                                        fill: color,
                                    zIndex: (element.zIndex ? element.zIndex : 0) - 1
                                    }).add(element.parentGroup);
                        },
                        alignAlignedLabels: function (chart) {
                            // Based on: https://stackoverflow.com/a/19326076
                            var alignedLabels = chart.alignedLabels;
                            if (!alignedLabels) {
                                return;
                            }
                            for (var i = 0; i < alignedLabels.length; i++) {
                                var alignedLabel = alignedLabels[i];
                                var labelObject = alignedLabel.label;
                                var labelBackground = alignedLabel.background;

                                labelObject.align(Highcharts.extend(
                                            labelObject.getBBox(),
                                            chart.options.alignedLabels.items[i]
                                            ), null, chart.renderer.spacingBox);
                                if (labelBackground) {
                                    labelBackground.align(Highcharts.extend(
                                                labelObject.getBBox(),
                                                chart.options.alignedLabels.items[i]
                                                ), null, chart.renderer.spacingBox);
                                }
                            }
                        }
                    },
                    redrawHandlers: [
                        function () {
                            var chart = this;
                            chart.options.chart.events.helperFunctions.alignAlignedLabels(chart);
                        }
                    ],
                    loadHandlers: [
                        function() {
                            var chart = this;
                            var alignedLabelsOptions = chart.options.alignedLabels;
                            if (!alignedLabelsOptions) {
                                return;
                            }

                            chart.alignedLabels = [];
                            for (var i = 0; i < alignedLabelsOptions.items.length; i++) {
                                var alignedLabel = {};
                                var alignedLabelOptions = alignedLabelsOptions.items[i];
                                alignedLabel.group = chart.renderer.g().add();
                                alignedLabel.label = chart.renderer.label(alignedLabelOptions.html).add(alignedLabel.group);

                                if (alignedLabelOptions.backgroundColor) {
                                    alignedLabel.background = chart.options.chart.events.helperFunctions.addBackgroundColor(alignedLabel.label, alignedLabelOptions.backgroundColor);
                                    alignedLabel.label.toFront();
                                }
                                chart.alignedLabels.push(alignedLabel);
                            }
                            chart.options.chart.events.helperFunctions.alignAlignedLabels(chart);
                        },
                        function () {
                            var chart = this;
                            if (!chart.series || chart.options.chart.showWarnings === false) {
                                return;
                            }

                            for (var i = 0; i < chart.series.length; i++) {
                                var series = chart.series[i];
                                if (!series.options.isRestrictedByRoles) {
                                    continue;
                                }

                                chart.options.chart.events.helperFunctions.addBackgroundColor(series.legendItem, "#DFDFDF");
                            }
                        }
                    ]
                }
            },
            legend: {
				labelFormatter: function() {
					var ret = '';
					var x = this.name;
					var indexOfSQ = x.indexOf(']');
					var brAlready = false;
					if( indexOfSQ > 0)
					{
						ret += x.substring(0,indexOfSQ+1)+'<br/>';
						 x = x.substring(indexOfSQ+1,x.length);
						brAlready = true;
					}
					var indexOfBr = x.indexOf('{');
					if( indexOfBr > 0 && !brAlready)
					{
						 ret += x.substring(0,indexOfBr)+'<br/>';
						 x = x.substring(indexOfBr,x.length);
					}
					ret+=x.wordWrap(50,'<br/>');
					return ret;
				}
            },
            plotOptions: {
                series: {
                    events: {
                        click: function (mouseEvent) {
                            XDMoD.Module.MetricExplorer.pointContextMenu(mouseEvent.point, mouseEvent.point.series.userOptions.datasetId);
                        },
                        legendItemClick: function () {
                            XDMoD.Module.MetricExplorer.seriesContextMenu(this, true, this.userOptions.datasetId);
                            return false;
                        }
                    }
                }
            }
        };

        if (chartOptions) {
            jQuery.extend(true, finalChartOptions, this.baseChartOptions, chartOptions);
        } else {
            jQuery.extend(true, finalChartOptions, this.baseChartOptions, this.chartOptions);
        }
        this.chart = new Highcharts.Chart(finalChartOptions);
    },

    /**
     * Instantiates a new chart that displays the given error message.
     *
     * @param  {String} mainMessage The main error message to display.
     * @param  {String} detailMessage (Optional) A secondary error message
     *                                to display.
     */
    displayError: function (mainMessage, detailMessage) {
        var errorChartOptions = {
            title: {
                text: mainMessage,
                verticalAlign: 'middle'
            }
        };

        if (detailMessage) {
            errorChartOptions.subtitle = {
                text: detailMessage,
                verticalAlign: 'middle',
                y: 32
            };
        }

        this.initNewChart.call(this, errorChartOptions);
    }
});

/**
 * Properly encodes a string for use as the title value in a HighChart instance.
 *
 * @param {String} text the text to be encoded for use in a HighChart title.
 * @return {String} the encoded text.
 **/
CCR.xdmod.ui.HighChartPanel.prototype.highChartsTextEncode = function(text) {
    if (!text) {
        return text;
    }
    return String(text).replace(/>/g, '&gt;').replace(/</g, '&lt;');
};
