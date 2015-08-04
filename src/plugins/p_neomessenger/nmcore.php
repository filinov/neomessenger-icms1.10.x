<?php

class nmCore {

/* -------------------------------------------------------------------------- */

    // Получаем тулбар
    public static function getBBCodeToolbar()
    {
        $bbcodetoolbar = cmsPage::getBBCodeToolbar('nm-msg-field', true, 'users');
        $bbcodetoolbar = preg_replace('/onclick=".*?smilespanel.*?"/i', 'id="nm-smiles-btn"', $bbcodetoolbar);
        return $bbcodetoolbar;
    }

/* -------------------------------------------------------------------------- */

    // Получаем список смайлов
    public static function getSmiles()
    {
        if ($handle = opendir(PATH . '/images/smilies'))
        {
            while (false !== ($file = readdir($handle)))
            {
                if ($file != '.' && $file != '..' && mb_strstr($file, '.gif'))
                {
                    $smiles[] = $file;
                }
            }

            closedir($handle);
        }

        return $smiles;
    }

/* -------------------------------------------------------------------------- */

    // Получаем количество новых сообщений
    public static function getNewMessagesCount($user_id)
    {
        return cmsDatabase::getInstance()->rows_count('cms_user_msg', "to_id = '$user_id' AND to_del = 0 AND is_new = 1");
    }

/* -------------------------------------------------------------------------- */

    // Получаем количество новых уведомлений
    public static function getNewNoticesCount($user_id)
    {
        return cmsDatabase::getInstance()->rows_count('cms_user_msg', "to_id = '$user_id' AND to_del = 0 AND is_new = 1 AND from_id < 0");
    }

/* -------------------------------------------------------------------------- */

    // Есть ли уведомления
    public static function isNoticesExists($user_id)
    {
        return (bool) cmsDatabase::getInstance()->rows_count('cms_user_msg', "to_id = '$user_id' AND to_del = 0 AND from_id < 0", 1);
    }

/* -------------------------------------------------------------------------- */

    // Есть ли такой пользователь
    public static function isUserExists($user_id)
    {
        return (bool) cmsDatabase::getInstance()->rows_count('cms_users', "id = '$user_id'", 1);
    }

/* -------------------------------------------------------------------------- */

    // Есть ли контакт в списке
    public static function isContactExists($user_id, $contact_id)
    {
        return (bool) cmsDatabase::getInstance()->rows_count('cms_user_contacts', "user_id = '$user_id' AND contact_id = '$contact_id'", 1);
    }

/* -------------------------------------------------------------------------- */

    // Добавляем юзера в список контактов
    public static function addContact($user_id, $contact_id)
    {
        return cmsDatabase::getInstance()->query("INSERT INTO cms_user_contacts (user_id, contact_id) VALUES ({$user_id}, {$contact_id})");
    }

/* -------------------------------------------------------------------------- */

    // Обновляет дату переписки с контактом
    public static function updateContactsDateLastMsg($user_id, $contact_id, $is_both = false)
    {
        $where = $is_both ? "user_id IN ($user_id, $contact_id) AND contact_id IN ($contact_id, $user_id)" : "user_id = $user_id AND contact_id = $contact_id";

        return cmsDatabase::getInstance()->query("UPDATE cms_user_contacts SET date_last_msg = CURRENT_TIMESTAMP WHERE $where");
    }

/* -------------------------------------------------------------------------- */

    // Получает список контактов
    public static function getContacts($user_id)
    {
        $inDB = cmsDatabase::getInstance();

        $res = $inDB->query("
            SELECT c.*, u.id as id, u.nickname as nickname, u.login as login, p.imageurl as avatar, IFNULL(COUNT(m.id), 0) as new_messages, IF(o.user_id, 1, 0) as online
            FROM cms_user_contacts c
            JOIN cms_users as u ON u.id = c.contact_id
            LEFT JOIN cms_user_profiles as p ON p.user_id = c.contact_id
            LEFT JOIN cms_user_msg as m ON m.from_id = c.contact_id AND m.to_id = c.user_id AND m.is_new = 1
            LEFT JOIN cms_online as o ON o.user_id = c.contact_id
            WHERE c.user_id = '$user_id' AND c.contact_id > 0
            GROUP BY c.contact_id
            ORDER BY c.date_last_msg desc
            LIMIT 1000
        ");

        $contacts = array();

        if ($inDB->num_rows($res))
        {
            while ($contact = $inDB->fetch_assoc($res))
            {
                array_push($contacts, array(
                    'id' => (int) $contact['id'],
                    'url' => cmsUser::getProfileURL($contact['login']),
                    'avatar' => cmsUser::getUserAvatarUrl($contact['id'], 'small', $contact['avatar']),
                    'online' => $contact['online'],
                    'nickname' => $contact['nickname'],
                    'new_messages' => $contact['new_messages']
                ));
            }
        }

        if (self::isNoticesExists($user_id))
        {
            array_unshift($contacts, array(
                'id'           => '-1',
                'nickname'     => 'Уведомления',
                'avatar'       => '/plugins/p_neomessenger/img/information.png',
                'new_messages' => self::getNewNoticesCount($user_id)
            ));
        }

        return $contacts;
    }

/* -------------------------------------------------------------------------- */

    public static function getMessages($user_id, $contact_id, $last_id = false, $first_id = false)
    {
        $inDB = cmsDatabase::getInstance();

        if ($contact_id > 0)
        {
            $where  = "( (m.from_id = $user_id AND m.from_del = 0) OR (m.from_id = $contact_id AND m.to_del = 0) ) AND ";
            $where .= "( (m.to_id = $user_id AND m.to_del = 0) OR (m.to_id = $contact_id AND m.from_del = 0) ) ";
        }
        else
        {
            $where = "m.from_id < 0 AND m.to_id = '$user_id' AND to_del = 0 ";
        }

        $where .= $last_id ? "AND m.id > '$last_id'" : ($first_id ? "AND m.id < '$first_id'" : "");

        $res = $inDB->query("
            SELECT m.*
            FROM cms_user_msg m
            WHERE $where
            ORDER BY m.id desc
            LIMIT 21
        ");

        $msgs = array();

        if ($inDB->num_rows($res))
        {
            while ($msg = $inDB->fetch_assoc($res))
            {
                $msg['senddate'] = cmsCore::dateFormat($msg['senddate']);
                $msgs[] = $msg;
            }
        }

        return $msgs;
    }

/* -------------------------------------------------------------------------- */

}