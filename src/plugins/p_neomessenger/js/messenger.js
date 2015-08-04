;(function($) {

    "use strict";

    var KEY_ESC   = 27;
    var KEY_TAB   = 9;
    var KEY_ENTER = 13

    var nm = {

        // Инициализация мессенджера
        init: function(opt) {

            this.my_mess       = $('.my_messages a');
            this.isMobile      = isMobile.any;
            this.oldMsgCount   = 0;
            this.listenTimer   = 0;
            this.listenEnabled = true;
            this.recipientId   = 0;

            $.extend(this, opt);

            this.sound.init();
            this.emoji.init();
            this.viewport.init();
            this.usersExtend();
            this.bindEvents();
            this.updateMsgCounter();
            this.listen();

        },

        // Переопределение методов users
        usersExtend: function() {

            var users = window.users || {};

            $.extend(users, {

                sendMess: function(id) {
                    nm.recipientId = id;
                    nm.open();
                    return false;
                },

                acceptFriend: function(id, link) {
                    $.post('/users/' + id + '/friendship.html', {}, function(data) {
                        nm.messages.del.call(link);
                        if (data.error == false) {
                            core.alert(data.text, 'Уведомление');
                        } else {
                            core.alert(data.text, 'Предупреждение');
                        }
                    }, 'json');
                },

                rejectFriend: function(id, link) {
                    $.post('/users/' + id + '/nofriends.html', {}, function(data) {
                        if (data.error == false) {
                            nm.messages.del.call(link);
                            core.alert(data.text, 'Уведомление');
                        }
                    }, 'json');
                }

            });

        },

        // Привязка обработчиков событий
        bindEvents: function() {

            // Навешиваемся на ссылку "Сообщения"
            $('body').on('click', 'a[href$=\'/messages.html\'], a[href$=\'/messages-notices.html\']', function() {
                nm.recipientId = 0;
                nm.open();
                return false;
            });

            // Срабатывает при открытии модального окна
            $('body').on('nm_opened', '#nm-overlay', function() {

                // Показ, скрытие списка контактов
                $(this).on('click', '.nm-toggle', function() {
                    nm.modal.$el.toggleClass('nm-contacts-open');
                });

                // Закрыть окно
                $(this).on('click', '.nm-close', function() {
                    nm.modal.hide();
                });

                if (nm.opt.closeOverlay) {
                    $(this).on('click', function(e) {
                        e = e.originalEvent || e;
                        var target = e.originalTarget || e.target || window;
                        if (target == $('#nm-overlay')[0]) {
                            nm.modal.hide();
                        }
                    });
                }

                // Открыть переписку с контактом
                $(this).on('click', '.user_contact', function() {
                    nm.contacts.select($(this).attr('rel'));
                });

                // Отправка сообщения при нажатии на кнопку
                $(this).on('click', '#nm-send', function() {
                    nm.messages.send();
                });

                // Массовая отправка сообщений
                $(this).on('click', '#nm-mass-send', function() {
                    nm.messages.massSend();
                });

                $(this).on('keydown', '#nm-msg-field', function(e) {
                    if (nm.opt.sendOnEnter) {
                        if (e.keyCode === KEY_ENTER) {
                            if (e.ctrlKey) {
                                $(this).val($(this).val() + "\r");
                            } else {
                                nm.messages.send();
                            }
                        }
                    } else {
                        if (e.keyCode === KEY_ENTER && e.ctrlKey) {
                            nm.messages.send();
                        }
                    }
                });

                // Сохранение текста в LocalStorage
                $(this).on('blur change keyup', '#nm-msg-field', function(e) {
                    nm.draft.update();
                });

                // Показать, скрыть смайлы
                $(this).on('click', '#nm-smiles-btn', function() {
                    nm.emoji.toggle();
                });

                // Отмечать сообщение как прочитанное при наведении на него курсора
                $(this).on('mouseenter click', '.conversation-item.new', function() {
                    nm.messages.setReaded($(this).attr('rel'));
                });

                // Удаление сообщения
                $(this).on('click', '.conversation-item .delete', function() {
                    nm.messages.del.call(this);
                });

                // Удаление контакта
                $(this).on('click', '.user_contact .delete', function(e) {
                    nm.contacts.del($(this).parent());
                    e.stopPropagation();
                });

                // Поиск контакта
                $(this).on('keyup', '#nm-search-inp', function() {
                    nm.contacts.filter();
                });

                // Очистить строку поиска
                $(this).on('click', '#nm-search-clr', function() {
                    $('#nm-userlist .user_contact').slideDown();
                    $('#nm-search-inp').val('');
                    $(this).hide();
                });

                nm.viewport.change();
            });

            // Обнуление переменных при закрытии окна
            $('body').on('nm_closed', '#nm-overlay', function() {
                nm.viewport.restore();
            });

            // перерасчет окна при ресайзе
            $(window).bind('resize', function() {
                if (nm.modal.visible) {
                    nm.modal.onDimensions();
                }
            });

            // Закрытие по "Esc" панели для вставки фото, или выбора из альбома
            $('body').on('keydown', function(e) {
                if (nm.modal.visible && e.keyCode === KEY_ESC) {
                    var $panelfoto = $('#nm-panelfoto', nm.modal.$el);
                    var $imginsert = $('#imginsert', nm.modal.$el);
                    if ($panelfoto.is(':visible')) $panelfoto.hide();
                    if ($imginsert.is(':visible')) $imginsert.hide();
                }
            });

        },

        listen: function() {

            clearInterval(nm.listenTimer);

            nm.listenTimer = setTimeout(function() {

                if (nm.listenEnabled) {

                    if (nm.modal.visible) {
                        nm.post('getUpdate', {
                            contact_id: nm.contacts.current.id,
                            message_last_id: nm.messages.lastId
                        }, function(data) {
                            if (data.contacts.length) {
                                $.each(data.contacts, function() {
                                    if (!nm.contacts.isExist(this.id)) {
                                        nm.contacts.add(this);
                                        nm.contacts.top(this.id);
                                    } else {
                                        nm.contacts.setCounter(this.id, this.new_messages);
                                        nm.contacts.setStatus(this.id, this.online);
                                    }
                                });
                            }

                            if (data.messages.length) {
                                $.each(data.messages, function() {
                                    nm.messages.add(this);
                                    nm.messages.lastId = this.id;
                                });

                                $('#nm-chat').waitForImages({
                                    finished: function() {
                                        nm.messages.scroll();
                                    },
                                    waitForAll: true
                                });
                            }

                            if (data.new_messages !== nm.msgCounter) {
                                nm.msgCounter = data.new_messages;
                                nm.updateMsgCounter();
                            }
                        });
                    } else {
                        nm.post('getNewMessages', {}, function(data) {
                            if (data.new_messages !== nm.msgCounter) {
                                nm.msgCounter = data.new_messages;
                                nm.updateMsgCounter();
                            }
                        });
                    }

                } else {
                    nm.listen();
                }

            }, nm.opt.listenInterval * 1000);

        },

        // POST запрос на сервер
        post: function(act, data, doneFunc, failFunc) {

            data.act = act;

            var request = $.ajax({
                url: nm.ajaxUrl,
                type: 'POST',
                data: data,
                dataType: 'json'
            });

            request.done(function(data) {
                if ($.isFunction(doneFunc)) {
                    doneFunc(data);
                }
            });

            request.fail(function(jqXHR, textStatus, errorThrown) {
                switch (textStatus) {
                    case 'error'       : console.error('NEOMESSENGER > Запрос: '+JSON.stringify(data)+', Статус: Ошибка соединения с сервером (' + errorThrown + ')'); break;
                    case 'parsererror' : console.error('NEOMESSENGER > Запрос: '+JSON.stringify(data)+', Статус: Ошибка разбора данных (' + errorThrown + ')'); break;
                    case 'timeout'     : console.error('NEOMESSENGER > Запрос: '+JSON.stringify(data)+', Статус: Ошибка таймаута (' + errorThrown + ')'); break;
                    default            : console.error('NEOMESSENGER > Запрос: '+JSON.stringify(data)+', Статус: Неизвестная ошибка (' + errorThrown + ')'); break;
                }
            });

            request.complete(function() {
                if (data.act == 'getUpdate' || data.act == 'getNewMessages') {
                    nm.listen();
                }
            });

        },

        plural: function(count, form1, form2, form3) {
            var result = count%10==1&&count%100!=11?form1:(count%10>=2&&count%10<=4&&(count%100<10||count%100>=20)?form2:form3);
            return (result || '%d').replace('%d', count);
        },

        updateMsgCounter: function() {

            if (nm.msgCounter > 0) {
                if (nm.msgCounter > nm.oldMsgCount) {
                    nm.sound.play();
                }

                $.animateTitle(['*********************', 'У вас ' + nm.plural(nm.msgCounter, '%d непрочитанное сообщение', '%d непрочитанных сообщения', '%d непрочитанных сообщений')], 1000);

                if (!nm.my_mess.hasClass('has_new')) {
                    nm.my_mess.addClass('has_new');
                }

                if ((nm.my_mess.text()).search(/ \(\d+\)/) == -1) {
                    nm.my_mess.text(nm.my_mess.text() + ' (' + nm.msgCounter + ')');
                } else {
                    nm.my_mess.text((nm.my_mess.text()).replace(/ \(\d+\)/, ' (' + nm.msgCounter + ')'));
                }
            } else {
                $.animateTitle('clear');
                nm.my_mess.text((nm.my_mess.text()).replace(/ \(\d+\)/, ''));

                if (nm.my_mess.hasClass('has_new')) {
                    nm.my_mess.removeClass('has_new');
                }
            }

            nm.oldMsgCount = nm.msgCounter;

        },

        // Открытие окна мессенджера
        open: function() {

            nm.modal.show();
            nm.contacts.load(nm.recipientId);

        },

        // Контакты
        contacts: {

            contactsList: [],
            current: {},
            _lock: false,

            load: function(id) {

                var self = nm.contacts;

                self.contactsList = [];
                self.current      = {};
                self._lock        = false;
                nm.listenEnabled  = false;
                self.unLock();

                nm.post('getContacts', {recipient_id: id}, function(data) {
                    var contacts = data.contacts;

                    if (contacts.length) {
                        $.each(contacts, function() {
                            self.add(this);
                        });

                        $('.nm-content').show();

                        if ($(window).width() > 479) {
                            self.select(self.contactsList[(self.contactsList.length > 1 ? 1 : 0)].id);
                        }

                        nm.modal.$el.addClass('nm-contacts-loaded');
                        nm.modal.onDimensions();
                    } else {
                        $('.nm-nomess').show();
                    }

                    nm.listenEnabled = true;
                    $('.nm-loading').hide();
                });

            },

            isExist: function(id) {

                for (var i = 0; i < this.contactsList.length; i++) {
                    if (this.contactsList[i].id == id) return true;
                }

                return false;

            },

            add: function(user) {

                if (this.isExist(user.id)) return;

                this.contactsList.push(user);

                $('#nm-userlist').append(nm.render.contact(user));

            },

            select: function(id) {

                if (this._lock) return;

                var contact = $('#nm-contact' + id);

                nm.modal.$el.addClass('nm-selected nm-contacts-open');

                if (contact.hasClass('selected')) return;

                $('#nm-userlist li').removeClass('selected');

                contact.addClass('selected');

                $.each(nm.contacts.contactsList, function() {
                    if (this.id == id) {
                        nm.contacts.current = this;
                        return;
                    }
                });

                nm.messages.load(id);

            },

            lock: function() {
                this._lock = true;
            },

            unLock: function() {
                this._lock = false;
            },

            del: function(contact) {

                var self = nm.contacts, 
                    counter = contact.find('.counter'),
                    contactId = contact.attr('rel');

                if (counter.length) {
                    if (contactId > 0) {
                        core.alert('От собеседника, который вы хотите удалить, есть непрочитанные сообщения.', 'Внимание!');
                    } else {
                        core.alert('У вас остались непрочитанные уведомления.', 'Внимание!');
                    }
                } else if (contact.hasClass('selected')) {
                    core.alert('С контактом, который вы хотите удалить, в данный момент вы ведете переписку. Выберите другой контакт, и затем удалите этот.', 'Внимание!');
                } else {
                    var confirm_msg = (contactId > 0) ? 'Вы уверены что хотите удалить контакт? (сообщения не удаляются, контакт убирается из списка)' : 'Вы уверены что хотите удалить все уведомления без возможности восстановления?';
                    core.confirm(confirm_msg, null, function() {
                        nm.post('delContact', {contact_id: contactId}, function(result) {
                            if (result.response === true) {
                                contact.slideUp(function() {
                                    $(this).remove();
                                });

                                for (var i = 0; i < self.contactsList.length; i++) {
                                    if (self.contactsList[i].id == contactId) {
                                        self.contactsList.splice(i, 1);
                                        break;
                                    }
                                }
                            }
                        });
                    });
                }

            },

            top: function(id) {

                var $contact = $('#nm-contact' + id),
                $container = $contact.parent(),
                $noticeCnt = $('#nm-contact-1');

                if (id == '-1') {
                    $container.prepend($contact);
                } else if ($noticeCnt.length) {
                    $noticeCnt.after($contact);
                } else {
                    $container.prepend($contact);
                }

                $container.scrollTop(0);

            },

            setCounter: function(id, count) {

                var $contact = $('#nm-contact' + id);
                var $counter = $('.counter', $contact);
                var old_count = $counter.length ? $counter.attr('rel') : 0;

                if ($counter.length) $counter.remove();

                if (count > 0) {
                    $contact.prepend('<span class="counter" rel="' + count + '">+ ' + count + '</span>');
                }

                if (count > old_count) {
                    this.top(id);
                }

            },

            setStatus: function(id, status) {

                $('#nm-contact' + id)[(status == '1' ? 'add' : 'remove') + 'Class']('_online');

            },

            filter: function() {

                var query = $('#nm-search-inp').val().trim();
                var reg   = new RegExp('^' + query.toUpperCase(), 'i');

                $('#nm-search-clr')[(query.length ? 'show' : 'hide')]();

                for (var i = 0; i < this.contactsList.length; i++) {
                    var c = this.contactsList[i],
                        $contact = $('#nm-contact' + c.id),
                        nickname = c.nickname,
                        result = reg.test(nickname.toUpperCase());

                    $contact['slide' + (result ? 'Down' : 'Up')]();
                }

            }

        },

        // Сообщения
        messages: {

            _sendLock: false,
            oldLoading: false,
            lastId: false,
            firstId: false,

            load: function(id) {

                var self = nm.messages;

                $('#nm-composer')[(id > 0 ? 'remove' : 'add') + 'Class']('nm-hide');
                $('#nm-chat-wrapper').hide();
                $('#nm-msg-loading').show();
                $('#nm-chat').html('').unbind('scroll');
                $('#nm-msg-field').val(nm.draft.get(id));

                this.lastId = false;
                this.firstId = false;
                this._sendLock = false;
                this.oldLoading = false;

                nm.listenEnabled = false;
                nm.contacts.lock();

                nm.post('getMessages', {contact_id: id}, function(data) {

                    var messages = data.messages;

                    $('#nm-msg-loading').hide();
                    $('#nm-chat-wrapper').show();

                    nm.listenEnabled = true;
                    nm.contacts.unLock();

                    if (messages.length) {
                        $.each(messages, function() {
                            self.add(this);
                        });

                        self.lastId = messages[messages.length - 1].id;

                        if (data.has_older) {
                            self.firstId = data.first_message_id;
                            $('#nm-chat').bind('scroll', function () {
                                if ($(this).scrollTop() <= 5) self.oldLoad();
                            });
                        }
                    }

                    nm.modal.onDimensions();

                    $('#nm-chat').waitForImages({
                        finished: function() {
                            self.scroll();
                        },
                        waitForAll: true
                    });

                });

            },

            add: function(message, prepend) {

                $('#nm-chat')[(prepend ? 'prepend' : 'append')](nm.render.message(message));

            },

            oldLoad: function() {

                if (this.oldLoading) return;

                this.oldLoading = true;
                nm.contacts.lock();

                var self = nm.messages;
                var chat = $('#nm-chat');

                chat.prepend('<div class="older-loading"></div>');

                nm.post('getOldMessages', {contact_id: nm.contacts.current.id, message_first_id: self.firstId}, function(data) {
                    chat.find('.older-loading').remove();

                    var oldFirstId = self.firstId;

                    if (data.messages.length) {
                        $.each(data.messages, function() {
                            self.add(this, true);
                        });

                        chat.waitForImages({
                            finished: function() {
                                var pos = chat.find('#nm-message-' + oldFirstId).position();
                                chat.scrollTop(chat.scrollTop() + pos.top);
                            },
                            waitForAll: true
                        });
                    }

                    if (data.has_older) {
                        self.firstId = data.first_message_id;
                    } else {
                        chat.unbind('scroll');
                        self.firstId = 0;
                    }

                    nm.contacts.unLock();
                    self.oldLoading = false;
                });

            },

            scroll: function() {

                $('#nm-chat').scrollTop($('#nm-chat')[0].scrollHeight);

            },

            del: function() {

                var message = $(this).closest('.conversation-item');
                var message_id = message.attr('rel');

                nm.post('delMessage', {message_id: message_id}, function(result) {
                    if (result.error == false) {
                        message.css('background', '#FFAEAE').fadeOut(function() {
                            $(this).remove();
                        });
                    }
                });
            },

            massSend: function() {

                if (this._sendLock) return;

                core.confirm('Вы уверены что хотите разослать сообщение всем пользователям сайта?', null, function() {
                    nm.messages.send(true);
                });

            },

            send: function(mass) {

                if (this._sendLock) return;

                var self = nm.messages;

                var $input = $('#nm-msg-field').focus();
                var $chat = $('#nm-chat');
                var text  = $input.val().trim();
                var to_id = nm.contacts.current.id;

                if (!text) return;
                if (!mass) nm.contacts.top(to_id);

                self.sendLock();
                nm.contacts.lock();
                nm.listenEnabled = false;

                var form_data = {
                    contact_id: to_id,
                    message: text,
                    last_id: this.lastId
                };

                if (mass) form_data.massmail = true;

                $input.attr('disabled', 'disabled');
                $chat.append('<div class="older-loading"></div>');
                self.scroll();

                nm.post('sendMessage', form_data, function(data) {
                    $chat.find('.older-loading').remove();
                    $input.removeAttr('disabled').val('');
                    nm.draft.del(to_id);

                    var messages = data.messages;

                    if (messages.length) {
                        $.each(messages, function() {
                            self.add(this);
                            self.lastId = this.id;
                        });

                        if (messages.length > 1) {
                            nm.msgCounter = messages.length;
                            nm.updateMsgCounter();
                        }

                        $chat.waitForImages({
                            finished: function() {
                                self.scroll();
                            },
                            waitForAll: true
                        });

                        $input.focus();
                    }

                    nm.contacts.unLock();
                    self.sendUnLock();
                    nm.listenEnabled = true;

                    if (data.alert) {
                        core.alert(data.alert);
                    }

                });

            },

            setReaded: function(id) {

                var $contact = $('#nm-contact' + nm.contacts.current.id);
                var $counter = $('.counter', $contact);
                var count    = $counter.length ? $counter.attr('rel') : 0;

                nm.contacts.setCounter(nm.contacts.current.id, --count);

                --nm.msgCounter;
                nm.updateMsgCounter();
                $('#nm-message-' + id).removeClass('new');
                nm.post('setMsgReaded', {message_id: id});

            },

            sendLock: function() {

                this._sendLock = true;

            },

            sendUnLock: function() {

                this._sendLock = false;

            },



        },

        draft: {

            update: function() {

                var text = $('#nm-msg-field').val();

                nm.ls.set('nm_draft_' + nm.user.id + '_' + nm.contacts.current.id, {text: text});

            },

            get: function(id) {

                return (nm.ls.get('nm_draft_' + nm.user.id + '_' + id) || {})['text'] || '';

            },

            del: function(id) {

                nm.ls.remove('nm_draft_' + nm.user.id + '_' + id);

            }

        },

        // Модальное окно
        modal: {

            visible: false,

            show: function() {

                $('html').addClass('nm-opened' + (nm.isMobile ? ' nm-mobile' : ''));
                $('body').append(nm.render.mainModal());

                this.$el = $('#nm-dialog');
                this.$bg = $('#nm-overlay');

                this.$el.fadeIn();
                this.$bg.trigger('nm_opened');

                this.onDimensions();

                this.visible = true;

            },

            hide: function() {

                var self = nm.modal;

                this.$bg.trigger('nm_closed');
                this.$el.fadeOut(function() {
                    $('html').removeClass('nm-opened' + (nm.isMobile ? ' nm-mobile' : ''));
                    $('#nm-dialog').remove();
                    self.$bg.remove();
                });

                this.visible = false;

            },

            onDimensions: function() {

                var headerHeight = 38; // Высота заголовка
                var searchHeight = 42; // Высота поиска
                var controlsHeight = $('#nm-composer').is(':visible') ? $('#nm-composer').outerHeight() : 0;
                var windowW = $(window).width();
                var windowH = $(window).height();
                var modalH = nm.modal.$el.height();
                var modalW = nm.modal.$el.width();

                $('#nm-chat').css({
                    height: modalH - headerHeight - controlsHeight
                });

                $('#nm-userlist').css({
                    height: modalH - headerHeight - searchHeight
                });

                if (nm.isMobile) return;

                var x = (windowH - modalH) / 2;
                var y = (windowW - modalW) / 2;

                nm.modal.$el.css({
                    top: x > 0 ? x : 0,
                    left: y > 0 ? y : 0
                });

            }

        },

        // Звуковое оповещение
        sound: {

            audio: null,
            volume: 0.5,
            enabled: true,
            supported: true,

            init: function() {
                var ext;

                try {
                    this.audio = new Audio();

                    if (('no' != this.audio.canPlayType('audio/mpeg')) && ('' != this.audio.canPlayType('audio/mpeg'))) {
                        ext = '.mp3';
                    } else if (('no' != this.audio.canPlayType('audio/ogg; codecs="vorbis"')) && ('' != this.audio.canPlayType('audio/ogg; codecs="vorbis"'))) {
                        ext = '.ogg';
                    } else {
                        this.supported = false;
                    }

                    if (this.supported) {
                        this.audio.src = nm.soundName + ext;
                        this.audio.load();
                        this.audio.preload = "auto";
                        this.audio.volume = this.volume;
                    }

                } catch (e) {}
            },

            play: function() {
                if (this.supported && this.enabled) {
                    this.audio.play();
                }
            }
        },

        // Смайлы
        emoji: {

            init: function() {

                var self = this;
                var $body = $(document.body);
                var $window = $(window);

                this.visible = false;

                this.$menu = $('<div>');
                this.$menu.addClass('emoji-menu');
                this.$menu.hide();

                this.$itemsWrap = $('<div class="emoji-items-wrap"></div>').appendTo(this.$menu);
                this.$items = $('<div class="emoji-items">').appendTo(this.$itemsWrap);

                $body.on('keydown', function(e) {
                    if (e.keyCode === KEY_ESC || e.keyCode === KEY_TAB) {
                        self.hide();
                    }
                });

                $body.on('mouseup', function(e) {
                    e = e.originalEvent || e;
                    var target = e.originalTarget || e.target || window;
                    while (target && target != window) {
                        target = target.parentNode;
                        if (target == self.$menu[0] || $('#nm-smiles-btn').length && target == $('#nm-smiles-btn')[0]) {
                            return;
                        }
                    }
                    self.hide();
                });

                this.$menu.on('mouseup', 'a', function(e) {
                    e.stopPropagation();
                    return false;
                });

                this.$menu.on('click', 'a', function(e) {
                    var emoji = $('.label', $(this)).text();
                    setTimeout(function() {
                        self.onItemSelected.apply(self, [emoji]);
                        if (e.ctrlKey || e.metaKey) {
                            self.hide();
                        }
                    }, 0);
                    e.stopPropagation();
                    return false;
                });

                this.load();
            },

            onItemSelected: function(emoji) {

                addSmile(emoji, 'nm-msg-field');

            },

            load: function() {

                var html = [];
                var options = nm.smilesList;
                var path = '/images/smilies/';
                var ext = '.gif';
                
                for (var key in options) {
                    if (options.hasOwnProperty(key)) {
                        var filename = options[key];
                        var name = filename.replace(ext, '');
                        html.push('<a href="javascript:void(0)" title="' + name + '"><img src="' + path + filename + '" alt="' + name + '"><span class="label">' + name + '</span></a>');
                    }
                }

                this.$items.html(html.join(''));

            },

            hide: function() {

                this.visible = false;
                this.$menu.hide().detach();

            },

            show: function() {

                this.$menu.appendTo('#nm-composer .usr_msg_bbcodebox');
                this.$menu.show();
                this.visible = true;

            },

            toggle: function() {

                this.visible ? this.hide() : this.show();

            }

        },

        // Вьюпорт
        viewport: {

            content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no',

            init: function() {

                if (!nm.isMobile) return;

                this.meta = $('meta[name=viewport]');

                if (this.meta.length) {
                    this.default = this.meta.attr('content');
                } else {
                    this.meta = $('<meta name="viewport" content="">').appendTo('head');
                    this.default = '';
                }
            },

            change: function() {

                if (!nm.isMobile) return;

                var content = this.content;

                this.meta.attr('content', content);

            },

            restore: function() {

                if (!nm.isMobile) return;

                var content = this.default;

                this.meta.attr('content', content);

            }

        },

        // LocalStorage
        ls: {

            supported: function() {
                return (window.localStorage !== undefined && window.JSON !== undefined);
            },

            set: function(key, val) {
                this.remove(key);
                try {
                    return this.supported() ? localStorage.setItem(key, JSON.stringify(val)) : false;
                } catch (e) {
                    return false;
                }
            },

            get: function(key) {
                try {
                    return this.supported() ? JSON.parse(localStorage.getItem(key)) : false;
                } catch (e) {
                    return false;
                }
            },

            remove: function(key) {
                try { localStorage.removeItem(key); } catch(e) {}
            }

        },

        // "Шаблонизатор"
        render: {

            mainModal: function() {

                return '' +
                '<div id="nm-overlay">' +
                    '<div id="nm-dialog" ' + (nm.isMobile ? 'class="mobile"' : '') + '>' +
                        '<div class="nm-header">' +
                            '<div class="nm-toggle"></div>' +
                            '<div class="nm-title">Моя переписка</div>' +
                            '<div class="nm-close" title="Закрыть окно"></div>' +
                        '</div>' +
                        '<div class="nm-body">' +
                            '<div class="nm-loading"></div>' +
                            '<div class="nm-nomess">Вы еще ни с кем не переписывались.</div>' +
                            '<div class="nm-content">' +
                                '<div class="nm-left">' +
                                    '<div class="nm-search-c-wrap">' +
                                        '<div class="nm-inp-c-bl">' +
                                            '<div class="nm-search-icon"></div>' +
                                            '<input type="text" id="nm-search-inp" value="" placeholder="Начните вводить имя...">' +
                                            '<div id="nm-search-clr" title="Сбросить фильтр"></div>' +
                                        '</div>' +
                                    '</div>' +
                                    '<ul id="nm-userlist"></ul>' +
                                '</div>' +
                                '<div class="nm-right">' +
                                    '<div id="nm-msg-loading"></div>' +
                                    '<div id="nm-chat-wrapper">' +
                                        '<div id="nm-chat" class="conversation-inner"></div>' +
                                        '<div id="nm-composer" class="nm-hide">' +
                                            '<div class="nm-editor">' +
                                                '<div class="usr_msg_bbcodebox">' +
                                                    nm.bbCodeToolBar +
                                                '</div>' +
                                                '<textarea id="nm-msg-field" placeholder="Введите текст сообщения"></textarea>' +
                                            '</div>' +
                                            '<div class="nm-buttons">' +
                                                '<button type="submit" id="nm-send" class="nm-submit">Отправить (' + (nm.opt.sendOnEnter ? 'Enter' : 'Ctrl+Enter') + ')</button>' +
                                                (nm.user.is_admin ? '<button type="submit" id="nm-mass-send" class="nm-submit">Отправить всем</button>' : '') +
                                            '</div>' +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="clearfix"></div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';

            },

            contact: function(user) {

                return '' +
                  '<li id="nm-contact' + user.id + '" class="user_contact' + (user.online == 1 ? ' _online' : '') + '" rel="' + user.id + '" >' +
                    (user.new_messages > 0 ? '<span class="counter" rel="' + user.new_messages + '">+ ' + user.new_messages + '</span>' : '') +
                    '<span class="delete" title="Удалить контакт"></span>' +
                    '<div class="userpic">' +
                      (user.id > 0 ? '<a href="' + user.url + '" target="_blank" title="Перейти в профиль пользователя">' : '') +
                        '<img src="' + user.avatar + '" width="31" height="31" />' +
                        (user.id > 0 ? '<span class="online_status"></span>' : '') +
                      (user.id > 0 ? '</a>' : '') +
                    '</div>' +
                    '<div class="username" title="' + user.nickname + '">' + user.nickname + '</div>' +
                  '</li>';

            },

            message: function(msg) {

                var isMy = false, cur = nm.contacts.current, avatar = cur.avatar, nickname = cur.nickname;

                if (nm.user.id == msg.from_id) {
                    isMy = true;
                    avatar = nm.user.avatar;
                    nickname = nm.user.nickname;
                }

                var isNew = (msg.is_new == 1 && !isMy) ? true : false;

                return '' +
                  '<div id="nm-message-' + msg.id + '" class="conversation-item ' + (isMy ? 'item-right' : 'item-left') + (isNew ? ' new' : '') + ' clearfix" rel="' + msg.id + '">' +
                    '<div class="conversation-user">' +
                      '<img src="' + avatar + '" alt="" width="40" height="40">' +
                    '</div>' +
                    '<div class="conversation-body">' +
                      '<div class="author">' + nickname + ':</div>' +
                      '<div class="date">' + msg.senddate + '</div>' +
                      '<div class="delete" title="Удалить ' + (cur.id > 0 ? 'сообщение' : 'уведомление') + '"></div>' +
                      '<div class="msg-content">' + msg.message + '</div>' +
                    '</div>' +
                  '</div>';

            }

        }

    };

    window.neomessenger = nm;

})(jQuery);