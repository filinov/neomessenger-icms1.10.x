!function($) {

    "use strict";

    // PROGRESSBAR CLASS DEFINITION
    // ============================

    var Progressbar = function(element) {
        this.$element = $(element);
    }

    Progressbar.prototype.update = function(value) {
        var $div = this.$element.find('div');
        var $span = $div.find('span');
        $div.attr('aria-valuenow', value);
        $div.css('width', value + '%');
        $span.text(value + '%');
    }

    Progressbar.prototype.finish = function() {
        this.update(100);
    }

    Progressbar.prototype.reset = function() {
        this.update(0);
    }

    // PROGRESSBAR PLUGIN DEFINITION
    // =============================

    $.fn.progressbar = function(option) {
        return this.each(function() {
            var $this = $(this),
                    data = $this.data('jbl.progressbar');

            if (!data)
                $this.data('jbl.progressbar', (data = new Progressbar(this)));
            if (typeof option == 'string')
                data[option]();
            if (typeof option == 'number')
                data.update(option);
        })
    };

    // PROGRESSBAR DATA-API
    // ====================

    $(document).on('click', '[data-toggle="progressbar"]', function(e) {
        var $this = $(this);
        var $target = $($this.data('target'));
        var value = $this.data('value');

        e.preventDefault();

        $target.progressbar(value);
    });

}(window.jQuery);

function start() {
    $('a').hide();
    $('.spinner').show();

    $.ajax({
        type: "POST",
        dataType: 'json',
        url: "/plugins/p_neomessenger/install.php",
        data: {act: 'install'},
        success: function(data) {
            $('.spinner').hide();

            if (data.count) {
                $('.progress').show().progressbar('reset');
                step();
            } else {
                $('#return').show();
                $('.alert').show().text('Сообщений в базе: 0. Анализ сообщений не требуется.');
            }
        }
    });
}

function step() {
    $.ajax({
        type: "POST",
        dataType: 'json',
        url: "/plugins/p_neomessenger/install.php",
        data: {act: 'step'},
        success: function(data) {
            if (data.done) {
                $('.progress').progressbar('finish');
                $('#return').show();
                $('.alert').show().text('Установка прошла успешно. Обработано ' + data.count + ' сообщений.');
                return;
            }

            $('.progress').progressbar(data.percent);

            step();      
        }
    });
}