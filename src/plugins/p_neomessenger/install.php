<?php

    session_start();
    header('Content-Type: text/html; charset=utf-8');

    define('VALID_CMS', 1);
    define('PATH', $_SERVER['DOCUMENT_ROOT']);

    include(PATH . '/core/cms.php');
    $inCore = cmsCore::getInstance(true);

    // Подключим базу и конфиг
    cmsCore::loadClass('db');
    cmsCore::loadClass('config');

    $inConf = cmsConfig::getInstance();
    $inDB   = cmsDatabase::getInstance();

    $version  = "2.1.0";
    $one_step = 1000; // Обрабатывать сообщений за один шаг

    $act = cmsCore::request('act', 'str', 'index');

    if ($act == 'install')
    {
        // Удаляем таблицу если она есть
        $inDB->query('
            DROP TABLE IF EXISTS cms_user_contacts
        ');

        // Создаем таблицу под контакты
        $inDB->query('
            CREATE TABLE cms_user_contacts (
              id int(11) NOT NULL AUTO_INCREMENT,
              user_id int(11) DEFAULT NULL,
              contact_id int(11) DEFAULT NULL,
              date_last_msg timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              KEY user_id (user_id),
              KEY contact_id (contact_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
        ');

        $msg_count = $inDB->rows_count('cms_user_msg', 'from_id > 0');
        $steps = floor($msg_count / $one_step);

        $_SESSION['nm']['values'] = array();
        $_SESSION['nm']['count']  = $msg_count;
        $_SESSION['nm']['steps']  = ($steps == 0) ? 1 : $steps;
        $_SESSION['nm']['step']   = 1;

        cmsCore::jsonOutput(array(
            'count' => $_SESSION['nm']['count']
        ));
    }

    if ($act == 'step')
    {
        if ($_SESSION['nm']['step'] <= $_SESSION['nm']['steps'])
        {
            $offset = $one_step * ($_SESSION['nm']['step'] - 1);
            $limit  = $one_step;

            // Извлекаем из таблицы с сообщениями всех отправителей и получателей
            $res = $inDB->query("
                SELECT m.from_id, m.to_id, m.from_del, m.to_del
                FROM cms_user_msg m
                WHERE m.from_id > 0
                ORDER BY m.senddate ASC
                LIMIT $offset, $limit
            ");

            if ($inDB->num_rows($res))
            {
                // Формируем список контактов
                while ($item = $inDB->fetch_assoc($res))
                {
                    if (!(int)$item['from_del'])
                    {
                        $value = array((int)$item['from_id'], (int)$item['to_id']);

                        if (!in_array($value, $_SESSION['nm']['values']) AND $value[0] > 0)
                        {
                            $_SESSION['nm']['values'][] = $value;
                            $inDB->query("INSERT INTO cms_user_contacts (user_id, contact_id) VALUES ({$value[0]}, {$value[1]})");
                        }
                    }

                    if (!(int)$item['to_del'])
                    {
                        $value = array((int)$item['to_id'], (int)$item['from_id']);

                        if (!in_array($value, $_SESSION['nm']['values']) AND $value[0] > 0)
                        {
                            $_SESSION['nm']['values'][] = $value;
                            $inDB->query("INSERT INTO cms_user_contacts (user_id, contact_id) VALUES ({$value[0]}, {$value[1]})");
                        }
                    }
                }
            }

            $_SESSION['nm']['step']++;

            cmsCore::jsonOutput(array(
                'done' => false,
                'percent' => floor(($_SESSION['nm']['step'] - 1) * 100 / $_SESSION['nm']['steps'])
            ));
        } else {
            cmsCore::jsonOutput(array(
                'done'  => true,
                'count' => $_SESSION['nm']['count']
            ));
        }
    }

    if ($act == 'finish')
    {
        unset($_SESSION['nm']);
        cmsCore::addSessionMessage('Плагин <b>"neomessenger"</b> установлен. Включите его, для начала работы.', 'success');
        cmsCore::redirect('/admin/index.php?view=plugins');
    }

    if ($act == 'index')
    {
?>
<!DOCTYPE html>
<html lang="ru">
    <head>
        <meta charset="utf-8">
        <title>Установщик плагина Neomessenger</title>
        <script src='/includes/jquery/jquery.js' type='text/javascript'></script>
        <script src='/plugins/p_neomessenger/js/install.js' type='text/javascript'></script>
        <link rel="stylesheet" href="/plugins/p_neomessenger/css/install.css"/>
    </head>
    <body>
        <div class="wrapper">
            <?="<h2>Установка плагина NEOmessenger {$version}</h2>";?>
            <div class="bs-callout bs-callout-info">
                <h4>Внимание!</h4>
                <p>Во время установки плагина, анализируются сообщения в базе и формируется список контактов.</p>
                <p>Перед началом установки плагина отключите сайт, что-бы избежать появления новых сообщений в базе во время установки.</p>
                <p>В зависимости от количества сообщений в базе, установка может занять продолжительное время.</p>
                <p>После окончания установки удалите файл install.php из папки с плагином.</p>
            </div>
            <a id="install" href="javascript:void(0);" onclick="start();">Начать установку</a>
            <a id="return" href="install.php?act=finish">Вернуться в админку</a>
            <div class="spinner"></div>
            <div class="progress progress-striped active">
                <div class="progress-bar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%">
                    <span>0%</span>
                </div>
            </div>
            <div class="alert alert-success"></div>
        </div>
    </body>
</html>
<?php } ?>