#!/usr/bin/env php
<?php
/**
 * Perform ETL on federated resources.  This is different than the traditional ETL process in that
 * it uses a new mechanism for passing options to the ingesters and is (hopefully) more flexible.
 *
 * @author Steve Gallo <smgallo@buffalo.edu>
 */

require __DIR__ . '/../../configuration/linker.php';
restore_exception_handler();

// Disable PHP's memory limit.
ini_set('memory_limit', -1);

$retval = ETL\EtlOverseerBootStrap::execute($argv);

exit($retval);
