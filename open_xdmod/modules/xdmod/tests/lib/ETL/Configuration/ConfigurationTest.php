<?php

namespace UnitTesting\ETL\Configuration;

/**
 * Tests for \ETL\Configuration\Configuration
 */
class ConfigurationTest extends \PHPUnit_Framework_TestCase
{
    public function testConfiguration()
    {
        $c = new \ETL\Configuration\Configuration("/tmp/test.json");
        $c->initialize();

        $this->assertEquals($c->seconExits('foo')

    }
}
