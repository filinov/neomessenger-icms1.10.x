<?php

/*******************************************************************************
 *                                                                             *
 *                         Плагин NeoMessenger ver:2.1.3                       *
 *                              Автор: NEOm@ster                               *
 *                         http://vk.com/filinov_victor                        *
 *                                                                             *
 *******************************************************************************/

    define('PATH', $_SERVER['DOCUMENT_ROOT']);
    include(PATH.'/core/ajax/ajax_core.php');
    include(PATH.'/plugins/p_neomessenger/nmcore.php');

    if (!$inUser->id) { cmsCore::halt(); }

    $act = cmsCore::request('act', 'str', '');

/* -------------------------------------------------------------------------- */

    // Получаем количество новых сообщений
    if ($act == 'getNewMessages')
    {
        $inUser->onlineStats();

        cmsCore::jsonOutput(array(
            'new_messages' => nmCore::getNewMessagesCount($inUser->id)
        ));
    }

/* -------------------------------------------------------------------------- */

    // Получаем список контактов
    if ($act == 'getContacts')
    {
        $recipient_id = cmsCore::request('recipient_id', 'int', 0);

        if ($recipient_id > 0)
        {
            $is_user_exists = nmCore::isUserExists($recipient_id);

            if (!$is_user_exists)
            {
                cmsCore::halt();
            }

            $is_contact_exists = nmCore::isContactExists($inUser->id, $recipient_id);

            if ($is_contact_exists)
            {
                nmCore::updateContactsDateLastMsg($inUser->id, $recipient_id);
            }

            if (!$is_contact_exists)
            {
                nmCore::addContact($inUser->id, $recipient_id);
            }
        }

        $contacts = nmCore::getContacts($inUser->id);

        cmsCore::jsonOutput(array('contacts' => $contacts));
    }

/* -------------------------------------------------------------------------- */

    // Получаем сообщения от контакта
    if ($act == 'getMessages')
    {
        $contact_id = cmsCore::request('contact_id', 'int', 0);

        if (!$contact_id) { cmsCore::halt(); }

        $messages = nmCore::getMessages($inUser->id, $contact_id);

        if (count($messages) === 21)
        {
            $has_older = true;
            array_pop($messages);
            $first_message_id = $messages[count($messages) - 1]['id'];
        }
        else
        {
            $has_older = false;
            $first_message_id = 0;
        }

        $messages = array_reverse($messages);

        cmsCore::jsonOutput(array(
            'messages' => $messages,
            'has_older' => $has_older,
            'first_message_id' => $first_message_id
        ));
    }

/* -------------------------------------------------------------------------- */

    // Обновление списка контактов и новых сообщений
    if ($act == 'getUpdate')
    {
        $contact_id  = cmsCore::request('contact_id', 'int', false);
        $msg_last_id = cmsCore::request('message_last_id', 'int', 0);

        $inUser->onlineStats();

        if (!$contact_id) {
            cmsCore::jsonOutput(array());
        }

        $new_messages = nmCore::getNewMessagesCount($inUser->id);
        $contacts     = nmCore::getContacts($inUser->id);
        $messages     = nmCore::getMessages($inUser->id, $contact_id, $msg_last_id);
        
        cmsCore::jsonOutput(array(
            'contacts' => $contacts,
            'messages' => array_reverse($messages),
            'new_messages' => $new_messages
        ));
    }

/* -------------------------------------------------------------------------- */

    // Удаляем сообщение
    if ($act == 'delMessage')
    {
        $message_id = cmsCore::request('message_id', 'int', 0);

        if (!$message_id) { cmsCore::halt(); }

        $message = $inDB->get_fields('cms_user_msg', "id = '$message_id'", '*');

        if (!$message) cmsCore::halt();

        // Сообщение мне от пользователя
        if ($message['to_id'] == $inUser->id)
        {
            if ($message['from_id'] > 0)
            {
                $inDB->query("UPDATE cms_user_msg SET to_del=1 WHERE id='$message_id' LIMIT 1");
            }
            else
            {
                $inDB->query("DELETE FROM cms_user_msg WHERE id='$message_id' LIMIT 1");
            }
        }

        // Сообщение от меня пользователю
        if ($message['from_id'] == $inUser->id)
        {
            if ($message['is_new'])
            {
                $inDB->query("DELETE FROM cms_user_msg WHERE id='$message_id' LIMIT 1");
            }
            else
            {
                $inDB->query("UPDATE cms_user_msg SET from_del=1 WHERE id='$message_id' LIMIT 1");
            }
        }

        // Удаляем сообщения, которые удалены с двух сторон
        $inDB->query("DELETE FROM cms_user_msg WHERE to_del=1 AND from_del=1");

        cmsCore::jsonOutput(array('error' => false));
    }

/* -------------------------------------------------------------------------- */

    // Удаляет диалог
    if ($act == 'delContact')
    {
        $contact_id = cmsCore::request('contact_id', 'int', 0);

        if (!$contact_id) { cmsCore::halt(); }

        if ($contact_id < 0)
        {
            // Удаляем уведомления
            $result = $inDB->query("DELETE FROM cms_user_msg WHERE to_id='{$inUser->id}' AND from_id < 0");
        }
        else
        {
            // Проверяем есть ли контакт в базе
            if (nmCore::isContactExists($inUser->id, $contact_id))
            {
                $result = $inDB->query("DELETE FROM cms_user_contacts WHERE user_id='{$inUser->id}' AND contact_id='$contact_id'");
            }
        }

        cmsCore::jsonOutput(array('response' => $result));
    }

/* -------------------------------------------------------------------------- */

    // Отправка сообщения
    if ($act == 'sendMessage')
    {
        $contact_id = cmsCore::request('contact_id', 'int', 0);
        $message    = cmsCore::request('message', 'html', '');
        $message    = cmsCore::parseSmiles($message, true);
        $last_id    = cmsCore::request('last_id', 'int', 0);

        if (!$contact_id || !$message) { cmsCore::halt(); }

        // Отправка одному пользователю
        if (!cmsCore::inRequest('massmail'))
        {
            cmsCore::loadModel('users');
            $model_user = new cms_model_users;

            $inUser->onlineStats();

            if (!nmCore::isContactExists($contact_id, $inUser->id))
            {
                nmCore::addContact($contact_id, $inUser->id);
            }

            nmCore::updateContactsDateLastMsg($inUser->id, $contact_id, true);

            // Отправляем сообщение
            $message_id = cmsUser::sendMessage($inUser->id, $contact_id, $message);

            // Отправляем уведомление на email если нужно
            $model_user->sendNotificationByEmail($contact_id, $inUser->id, $message_id);

            $messages = nmCore::getMessages($inUser->id, $contact_id, $last_id);
            $messages = array_reverse($messages);

            cmsCore::jsonOutput(array('messages' => $messages));

        }

        if (!$inUser->is_admin) { cmsCore::halt(); }

        // отправить всем: получаем список всех пользователей
        $userlist = cmsUser::getAllUsers();

        if (!$userlist) { cmsCore::halt(); }

        $count = array();

        // отправляем всем по списку
        foreach ($userlist as $user)
        {
            $count[] = cmsUser::sendMessage(USER_MASSMAIL, $user['id'], $message);
        }

        cmsCore::jsonOutput(array(
            'alert' => sprintf('Сообщение отправлено всем пользователям (%s)', sizeof($count)),
            'messages' => array()
        ));
    }

/* -------------------------------------------------------------------------- */

    // Отмечает сообщение как прочитанное
    if ($act == 'setMsgReaded')
    {
        $is_all_msg = cmsCore::request('all', 'int', 0);
        $message_id = cmsCore::request('message_id', 'int', 0);
        $contact_id = cmsCore::request('contact_id', 'int', 0);

        if (!$is_all_msg && !$message_id) { cmsCore::halt(); }
        if ($is_all_msg && !$contact_id) { cmsCore::halt(); }

        if ($is_all_msg) {
            if ($contact_id > 0) {
                $result = $inDB->query("UPDATE cms_user_msg m SET is_new = 0 WHERE m.is_new = 1 AND m.from_id = $contact_id AND m.to_id = {$inUser->id} LIMIT 50");
            } else {
                $result = $inDB->query("UPDATE cms_user_msg m SET is_new = 0 WHERE m.is_new = 1 AND m.from_id < 0 AND m.to_id = {$inUser->id} LIMIT 50");
            }
        } else {
            $result = $inDB->query("UPDATE cms_user_msg m SET is_new = 0 WHERE m.id = '$message_id' LIMIT 1");
        }

        cmsCore::jsonOutput(array('response' => $result));
    }

/* -------------------------------------------------------------------------- */

    // Показывает старые сообщения
    if ($act == 'getOldMessages')
    {
        $contact_id = cmsCore::request('contact_id', 'int', 0);
        $first_id   = cmsCore::request('message_first_id', 'int', 0);

        if (!$contact_id || !$first_id) { cmsCore::halt(); }

        $messages = nmCore::getMessages($inUser->id, $contact_id, false, $first_id);

        if (count($messages) === 21)
        {
            $has_older = true;
            array_pop($messages);
            $first_message_id = $messages[count($messages) - 1]['id'];
        }
        else
        {
            $has_older = false;
            $first_message_id = 0;
        }

        cmsCore::jsonOutput(array(
            'messages' => $messages,
            'has_older' => $has_older,
            'first_message_id' => $first_message_id
        ));
    }

/* -------------------------------------------------------------------------- */

    cmsCore::halt();