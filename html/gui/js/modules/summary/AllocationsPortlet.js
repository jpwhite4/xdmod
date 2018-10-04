/**
 * XDMoD.Modules.SummaryPortlets.AllocationsPortlet
 *
 */

Ext.namespace('XDMoD.Modules.SummaryPortlets');

XDMoD.Modules.SummaryPortlets.AllocationsPortlet = Ext.extend(Ext.ux.Portlet, {

    layout: 'border',
    title: 'Allocation Information for ' + CCR.xdmod.ui.fullName,

    initComponent: function () {
        XDMoD.Modules.SummaryPortlets.AllocationsPortlet.superclass.initComponent.apply(this, arguments);
    },

    listeners: {
        reload: function () {
            // TODO
        },
        duration_change: function (timeframe) {
            // TODO
        }
    }
});
