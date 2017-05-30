<?php

namespace RegressionTests\Controllers;

class UsageExplorerTest extends \PHPUnit_Framework_TestCase
{
    protected function setUp()
    {
        $this->helper = new \TestHarness\XdmodTestHelper();
        $this->helper->authenticate("po");

    }

    /**
     * @dataProvider csvExportProvider
     */
    public function testCsvExport($input, $expected, $testName)
    {
        $input['format'] = 'csv';
        $input['drilldowns'] = '[object+Object]';
        $input['resource'] = '1';

        $response = $this->helper->post('/controllers/user_interface.php', null, $input);
        $csvdata = $response[0];
        $curldata = $response[1];

        if ($expected === null) {
            // Create mode
            file_put_contents(__DIR__ . '/../../artifacts/expected/' . $testName . '.csv', $csvdata);
            return;
        }
        
        $this->assertEquals($curldata['content_type'], "application/xls");
        $this->assertEquals($expected, $csvdata);
    }

    public function csvExportProvider()
    {
        $testData = array();

        $basePath = __DIR__ . '/../../artifacts/input';

        foreach (glob($basePath . '/*.json') as $filename) {
            $testCase = array(
                json_decode(file_get_contents($filename), true),
                null,
                basename($filename)
            );
            if (file_exists(__DIR__ . '/../../artifacts/expected/' . basename($filename) . '.csv') ) {
                $testCase[1] = file_get_contents(__DIR__ . '/../../artifacts/expected/' . basename($filename) . '.csv');
            }
            $testData[] = $testCase;
        }

        return $testData;
    }
}
