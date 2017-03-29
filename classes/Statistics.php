<?php

use CCR\DB;
use CCR\DB\iDatabase;
use Exception;
use Statistic;

class Statistics
{
    public static function listStatistics()
    {
        return self::_listStatistics(
            DB::factory('database')
        );
    }

    public static function listPermittedStatistics(XDUser $user, $realmName, $groupByName)
    {
        if (!isset($user)) {
            throw new Exception('A valid user is required.');
        }

        if (!isset($realmName)) {
            throw new Exception('A valid realm is required.');
        }
        if (!isset($groupByName)) {
            throw new Exception('A valid group by is required.');
        }

        return self::_listPermittedStatistics(
            DB::factory('database'),
            $user->getUserID(),
            $realmName,
            $groupByName
        );
    }

    private static function _listStatistics(iDatabase $db)
    {
        $query = <<<SQL
SELECT s.*
FROM statistics s
SQL;
        $rows = $db->query($query);
        if ($rows !== false && count($rows) > 0) {
            return array_reduce(
                $rows,
                function ($carry, $item) {
                    $carry []= new Statistic($item);
                    return $carry;
                },
                array()
            );
        }
        return array();
    }

    private static function _listPermittedStatistics(iDatabase $db, $userId, $realmName, $groupByName)
    {
        $query = <<<SQL
SELECT DISTINCT s.*
FROM statistics s
  JOIN acl_group_bys agb
    ON s.statistic_id = agb.statistic_id
  JOIN user_acls ua
    ON agb.acl_id = ua.acl_id
  JOIN group_bys gb
    ON agb.group_by_id = gb.group_by_id
  JOIN realms r
    ON gb.realm_id = r.realm_id
WHERE
  ua.user_id = :user_id
  AND r.name = :realm_name
  AND gb.name = :group_by_name
  AND agb.visible = TRUE
  AND agb.enabled = TRUE;
SQL;

        $rows = $db->query($query, array(
            ':user_id' => $userId,
            ':realm_name' => $realmName,
            ':group_by_name' => $groupByName
        ));

        if ($rows !== false && count($rows) > 0) {
            return array_reduce(
                $rows,
                function ($carry, $item) {
                    $carry []= new Statistic($item);
                    return $carry;
                },
                array()
            );
        }
        return array();
    }
}
