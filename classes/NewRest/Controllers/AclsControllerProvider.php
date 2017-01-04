<?php namespace NewRest\Controllers;

use Silex\Application;
use Silex\ControllerCollection;

use Symfony\Component\HttpFoundation\Request;
use User\Acl;
use User\Acls;

class AclsControllerProvider extends BaseControllerProvider
{

    /**
     * This function is responsible for the setting up of any routes that this
     * ControllerProvider is going to be managing. It *must* be overridden by
     * a child class.
     *
     * @param Application $app
     * @param ControllerCollection $controller
     * @return null
     */
    public function setupRoutes(Application $app, ControllerCollection $controller)
    {
        $root = $this->prefix;
        $class = get_class($this);
        $conversions = '\NewRest\Utilities\Conversions';

        $controller->get("$root/", "$class::listAcls");
        $controller->post("$root/", "$class::createAcl");
        $controller->get("$root/{id}", "$class::getAcl")
            ->assert('id', '^\d+')
            ->convert('id', "$conversions::toInt");
        $controller->put("$root/{id}", "$class::updateAcl")
            ->assert('id', '^\d+')
            ->convert('id', "$conversions::toInt");
        $controller->delete("$root/{id}", "$class::deleteAcl")
            ->assert('id', '^\d+')
            ->convert('id', "$conversions::toInt");

        $controller->get("$root/current", "$class::listUserAcls");
    }

    public function listAcls(Request $request, Application $app)
    {
        return $app->json(
            array(
                'success' => true,
                'results' => Acls::getAcls()
            )
        );
    }

    public function createAcl(Request $request, Application $app)
    {
        $moduleId = self::getIntParam($request, Acl::MODULE_ID, true);
        $aclTypeId = self::getIntParam($request, Acl::ACL_TYPE_ID, true);
        $name = self::getStringParam($request, Acl::NAME, true);
        $display = self::getStringParam($request, Acl::DISPLAY, false, $name);
        $enabled = self::getBooleanParam($request, Acl::ENABLED, false);

        $acl = Acls::createAcl(
            new Acl(
                array(
                    Acl::MODULE_ID => $moduleId,
                    Acl::ACL_TYPE_ID => $aclTypeId,
                    Acl::NAME => $name,
                    Acl::DISPLAY => $display,
                    Acl::ENABLED => $enabled
                )
            )
        );

        $success = isset($acl);
        $status = true == $success ? 200 : 500;
        return $app->json(array(
            'success' => $success,
            'results' => $acl
        ), $status);
    }

    public function getAcl(Request $request, Application $app, $id)
    {
        $acl = Acls::getAcl($id);
        $success = isset($acl);
        $status = true == $success ? 200 : 404;

        return $app->json(array(
            'success' => $success,
            'results' => $acl
        ), $status);
    }

    public function updateAcl(Request $request, Application $app, $id)
    {
        $moduleId = self::getIntParam($request, Acl::MODULE_ID, true);
        $aclTypeId = self::getIntParam($request, Acl::ACL_TYPE_ID, true);
        $name = self::getStringParam($request, Acl::NAME, true);
        $display = self::getStringParam($request, Acl::DISPLAY, false, $name);
        $enabled = self::getBooleanParam($request, Acl::ENABLED, false);

        $success = Acls::updateAcl(
            new Acl(
                array(
                    ACL::ACL_ID => $id,
                    Acl::MODULE_ID => $moduleId,
                    Acl::ACL_TYPE_ID => $aclTypeId,
                    Acl::NAME => $name,
                    Acl::DISPLAY => $display,
                    Acl::ENABLED => $enabled
                )
            )
        );
        $status = true == $success ? 200 : 500;

        return $app->json(array(
            'success' => $success,
            'result' => $success
        ), $status);
    }

    public function deleteAcl(Request $request, Application $app, $id)
    {
        $success = Acls::deleteAcl(
            new Acl(
                array(
                    Acl::ACL_ID => $id
                )
            )
        );
        $status = true == $success ? 200 : 500;
        return $app->json(array(
            'success' => $success,
            'results' => $success
        ), $status);
    }

    public function listUserAcls(Request $request, Application $app)
    {
        $user = $request->attributes->get(BaseControllerProvider::_USER);
        $acls = Acls::listUserAcls($user);
        return $app->json(array('results' => $acls));
    }
}
