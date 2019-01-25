/**
 * XDMoD.Modules.SummaryPortlets.ChartThumbnailPortlet
 *
 */

Ext.namespace('XDMoD.Modules.SummaryPortlets');

XDMoD.Modules.SummaryPortlets.ChartThumbnailPortlet = Ext.extend(Ext.Panel, {

    layout: 'fit',
    header: false,
    tbar: {
        items: [
            'Time Range:',
            ' ',
            {
                text: 'Previous Quarter'
            },
            {
                text: 'Previous Year'
            },
            {
                xtype: 'splitbutton',
                text: 'Custom'
            },
            ' ',
            '|',
            ' ',
            {
                text: 'Download Report',
                icon: 'gui/images/report_generator/pdf_icon.png',
                cls: 'x-btn-text-icon'
            }
        ]
    },

    /**
     *
     */
    initComponent: function () {
        var aspectRatio = 0.6;

        var store = new Ext.data.JsonStore({
            // Note that the following report id is hardcoded to one in jpwhite4's profile
            // it will not work for anyone else. This is for PROTOTYPE TESTING only!!!!
            url: XDMoD.REST.url + '/report/report/1-1530280556.4036',
            restful: true,
            baseParams: {
                token: XDMoD.REST.token
            },
            root: 'data',
            fields: [
                'chart_id',
                'thumbnail_link',
                'ordering',
                'chart_title',
                'chart_drill_details',
                'chart_date_description',
                'type',
                'timeframe_type'
            ]
        });
        store.load();

        var tpl = new Ext.XTemplate(
                '<tpl for=".">',
                '<div class="thumb-wrap">',
                '<span>{chart_title}</span>',
                '<div class="thumb"><img src="{thumbnail_link}' + XDMoD.REST.token + '" title="{chart_title}"></div>',
                '</div>',
                '</tpl>',
                '<div class="x-clear"></div>'
                );

        var panel = new Ext.Panel({
            id: 'images-view',
            height: 400,
            border: false,
            header: false,
            layout: 'fit',

            items: new Ext.DataView({
                store: store,
                tpl: tpl,
                autoHeight: true,
                multiSelect: true,
                overClass: 'x-view-over',
                itemSelector: 'div.thumb-wrap',
                emptyText: 'No images to display',

                plugins: [
                    new Ext.DataView.DragSelector(),
                    new Ext.DataView.LabelEditor({ dataIndex: 'name' })
                ],

                prepareData: function (data) {
                    data.shortName = Ext.util.Format.ellipsis(data.name, 15);
                    data.sizeString = Ext.util.Format.fileSize(data.size);
                    return data;
                },

                listeners: {
                    selectionchange: {
                        fn: function (dv, nodes) {
                            var l = nodes.length;
                            var s = l !== 1 ? 's' : '';
                            panel.setTitle('Simple DataView (' + l + ' item' + s + ' selected)');
                        }
                    }
                }
            })
        });

        this.items = [panel];

        XDMoD.Modules.SummaryPortlets.ChartThumbnailPortlet.superclass.initComponent.apply(this, arguments);
    }
});

/**
 * The Ext.reg call is used to register an xtype for this class so it
 * can be dynamically instantiated
 */
Ext.reg('ChartThumbnailPortlet', XDMoD.Modules.SummaryPortlets.ChartThumbnailPortlet);
