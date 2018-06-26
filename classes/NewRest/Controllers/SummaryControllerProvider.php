<?php

namespace NewRest\Controllers;

use Silex\Application;
use Symfony\Component\HttpFoundation\Request;
use Silex\ControllerCollection;
use \Symfony\Component\HttpFoundation\JsonResponse;

use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class SummaryControllerProvider extends BaseControllerProvider
{
    /**
     * The identifier that is used to store summary tab layout settings in the user profile.
     *
     * @var string
     */
    const SUMMARY_LAYOUT = 'summary_layout';

    /**
     * @see BaseControllerProvider\setupRoutes
     */
    public function setupRoutes(Application $app, ControllerCollection $controller)
    {
        $endpoint = $this->prefix . '/layout';
        $namespace = '\NewRest\Controllers\SummaryControllerProvider';

        $controller->get($endpoint, $namespace . '::getLayout');
        $controller->put($endpoint . '/{id}', $namespace . '::setLayout');
        $controller->post($endpoint, $namespace . '::setLayout');
    }

    /**
     * @param Request $request
     * @param Application $app
     * @return JsonResponse
     */
    public function setLayout(Request $request, Application $app, $id = null)
    {
        $user = $this->authorize($request);

        $rdata = json_decode($this->getStringParam($request, 'data', true), true);

        if (!isset($rdata['layout'])) {
            throw new BadRequestHttpException('Missing required layout information');
        }

        if (!isset($id)) {
            if (!isset($rdata['recordid'])) {
                throw new BadRequestHttpException('Missing required recordid information');
            }
            $id = (int)$rdata['recordid'];
        }

        if (count($rdata['layout']) !== (int)$id) {
            throw new BadRequestHttpException('column count mismatch');
        }

        // TODO check that all data are numeric - numeric arrays

        $layoutStore = new \UserStorage($user, self::SUMMARY_LAYOUT);
        $layoutStore->upsert($id, $rdata);

        return $app->json(
            array(
                'success' => true,
                'data' => $rdata,
                'total' => count($layoutStore->get())
            )
        );
    }

    /**
     * @param Request $request
     * @param Application $app
     * @return JsonResponse
     */
    public function getLayout(Request $request, Application $app)
    {
        $user = $this->authorize($request);

        $userProfile = new \UserStorage($user, self::SUMMARY_LAYOUT);

        $layout = $userProfile->get();

        return $app->json(
            array(
                'success' => true,
                'total' => count($layout),
                'data' => $layout
            )
        );
    }
}
