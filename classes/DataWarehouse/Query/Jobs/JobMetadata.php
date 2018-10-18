<?php

namespace DataWarehouse\Query\Jobs;

class JobMetadata
{
    public function getJobMetadata($user, $jobid)
    {
        $job = $this->lookupJob($user, $jobid);
        if ($job == null) {
            return array();
        }

        return array(
            \DataWarehouse\Query\RawQueryTypes::ACCOUNTING => true
        );
    }

    /*
     * Get the local_job_id, end_time, etc for the given job entry in the
     * database. This information is used to lookup the job summary/timeseries
     * data in the document store. (But see the to-do note below).
     */
    private function lookupJob($user, $jobid)
    {
        $params = array(new \DataWarehouse\Query\Model\Parameter("job_id", "=", $jobid));

        $query = new \DataWarehouse\Query\Jobs\JobDataset($params);
        $query->setMultipleRoleParameters($user->getAllRoles(), $user);
        $stmt = $query->getRawStatement();

        $job = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        if (count($job) != 1) {
            return null;
        }
        return $job[0];
    }
}
