<?php
/*******************************************************************************
 *                                                                             *
 *                         Плагин NeoMessenger ver:2.1.3                       *
 *                              Автор: NEOm@ster                               *
 *                         http://vk.com/filinov_victor                        *
 *                                                                             *
 *******************************************************************************/

class p_neomessenger extends cmsPlugin {

    public function __construct()
    {
        // Информация о плагине
        $this->info['plugin']      = 'p_neomessenger';
        $this->info['title']       = 'NeoMessenger';
        $this->info['description'] = 'Переписка в всплывающем окне на аякс';
        $this->info['author']      = '<a target="_blank" href="https://vk.com/neomessenger">NEOm@ster</a>';
        $this->info['version']     = '2.1.3';

        // Настройки по-умолчанию
        $this->config['PNM_TIME_UPDATE']   = 20;
        $this->config['PNM_SEND_TYPE']     = 1;
        $this->config['PNM_CLOSE_OVERLAY'] = 0;
        $this->config['PNM_READ_ALL_MSG']  = 0;

        // События, которые будут отлавливаться плагином
        $this->events[] = 'PRINT_PAGE_HEAD';

        parent::__construct();
    }

/* -------------------------------------------------------------------------- */

    /**
     * Процедура установки плагина
     * @return bool
     */
    public function install()
    {
        if (parent::install()) {
            cmsCore::redirect('/plugins/p_neomessenger/install.php');
        }
    }

/* -------------------------------------------------------------------------- */

    // Обновление плагина
    public function upgrade()
    {
        return parent::upgrade();
    }

/* -------------------------------------------------------------------------- */
    
    /**
     * Обработка событий
     * @param string $event
     * @param mixed $item
     * @return mixed
     */
    public function execute($event = '', $item = array())
    {
        switch ($event)
        {
            case 'PRINT_PAGE_HEAD': $item = $this->AddPluginToPage($item); break;
        }

        return $item;
    }

/* -------------------------------------------------------------------------- */

    /**
     * Добавление файлов плагина на страницу
     */
    private function AddPluginToPage($head)
    {
        $inUser = cmsUser::getInstance();

        if (!$inUser->id || defined('VALID_CMS_ADMIN'))
        {
            return $head;
        }

        $inPage = cmsPage::getInstance();

        include 'nmcore.php';

        $plugin  = "plugins/{$this->info['plugin']}";
        $noCache = $this->info['version'];

        $config = array(

            'user' => array(
                'id'       => (int) $inUser->id,
                'nickname' => $inUser->nickname,
                'avatar'   => $inUser->imageurl,
                'is_admin' => (bool) $inUser->is_admin
            ),

            'opt' => array(
                'listenInterval' => (int) $this->config['PNM_TIME_UPDATE'],
                'sendOnEnter'    =>       $this->config['PNM_SEND_TYPE'] == 1,
                'closeOverlay'   => (bool)$this->config['PNM_CLOSE_OVERLAY'],
                'readAllMsg'     => (bool)$this->config['PNM_READ_ALL_MSG']
            ),

            'msgCounter'     => nmCore::getNewMessagesCount($inUser->id),
            'bbCodeToolBar'  => nmCore::getBBCodeToolbar(),
            'smilesList'     => nmCore::getSmiles(),
            'ajaxUrl'        => "/$plugin/nmajax.php",
            'soundName'      => "/$plugin/sounds/notify"

        );

/* -------------------------------------------------------------------------- */

        $inPage->addHeadCSS("$plugin/css/styles.css?no_cache=" . $noCache);
        $inPage->addHeadJS("$plugin/js/isMobile.js");

        $inPage->addHeadJS("$plugin/js/animatetitle.js");
        $inPage->addHeadJS("$plugin/js/jquery.waitforimages.js");
        $inPage->addHeadJS("$plugin/js/messenger.js?no_cache=" . $noCache);

/* -------------------------------------------------------------------------- */

        $inPage->addHead("<script>$(function() { neomessenger.init(" . json_encode($config) . "); });</script>");

/* -------------------------------------------------------------------------- */

        // Возвращаем head
        return $inPage->page_head;
    }

/* -------------------------------------------------------------------------- */

}