<?php

   try {
      
   	$user = \xd_security\getLoggedInUser();
   		
   	$rm = new XDReportManager($user);
      $cp = new XDChartPool($user);
   
   	$returnData['status'] = 'success';
   	
   	$returnData['has_charts_in_other_roles'] = (count($charts_in_other_roles) > 0);

   	$returnData['queue'] = $rm->fetchChartPool();
   
   	\xd_controller\returnJSON($returnData);
	
	}
   catch (SessionExpiredException $see) {
      // TODO: Refactor generic catch block below to handle specific exceptions,
      //       which would allow this block to be removed.
      throw $see;
   }
   catch (Exception $e) {

	    \xd_response\presentError($e->getMessage());
	    
	}

?>