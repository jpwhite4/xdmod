<?php

namespace Rest\Controllers;

use Silex\Application;
use Silex\ControllerCollection;
use Symfony\Component\HttpFoundation\Request;
use DataWarehouse\Query\Exceptions\BadRequestException;

class ReportControllerProvider extends BaseControllerProvider
{
    /**
     * @see BaseControllerProvider::setupRoutes
     */
    public function setupRoutes(Application $app, ControllerCollection $controller)
    {
        $root = $this->prefix;
        $class = get_class($this);

        $controller->get("$root/report/{reportid}", "$class::getReport");
    }

    public function getReport(Request $request, Application $app, $reportid)
    {
        $user = $this->authorize($request);

        // TODO - implement code that generates report from template if it does not
        // already exist!

        $rm = new \XDReportManager($user);

        $data = $rm->loadReportData($reportid);

        $result = array(
            'success' => $data['success'],
        );
        if (isset($data['queue'])) {
            $result['count'] = count($data['queue']);
            $result['data'] = $data['queue'];
        }
        if (isset($data['message'])) {
            $result['message'] = $data['message'];
        }

        return $app->json($result);
    }
}
