/**
 * Created by Q-Solutions Studio
 * Date: 30.07.2020
 *
 * @category    Magespices
 * @package     Magespices_Bitcan
 * @author      Maciej Buchert <maciej@qsolutionsstudio.com>
 */
define(
    [
        'jquery',
        'mage/translate',
        'Magento_Checkout/js/view/payment/default',
        'ko',
        'Magento_Ui/js/modal/modal',
        'Magento_Checkout/js/model/quote',
        'Magento_Checkout/js/checkout-data',
        'Magento_Catalog/js/price-utils',
        'Magento_Ui/js/model/messageList',
        'mage/url',
        'https://www.google.com/recaptcha/api.js',
        'https://cdn.bitcan.pl/purchase_box/js/bcwidget.js',
    ],
    function ($, $t, Component, ko, modal, quote, checkoutData, priceUtils, messageList , url) {
        'use strict';

        return Component.extend({
            defaults: {
                template: 'Magespices_Bitcan/payment/bitcan',
            },
            redirectAfterPlaceOrder: false,
            host: 'https://bitcoinwidget.pl/api',
            config: {},
            endpoints: {
                variables: {
                    partner_id: null,
                },
                convertToBtc: '/rates.json?amount_type=PLN&amount=${amount}&partner_id=${partner_id}',
                feeEstimation: '/rates/fee.json?amount=${amount}',
                authenticationStart: '/widget/authentication/start',
                authenticationToken: '/widget/authentication/token',
                transaction: '/widget/transactions',
                transactionVerification: '/widget/transactions/${code}',
                paymentMethods: '/widget/payment-methods?partner_id=${partner_id}&type=json',
                exchangeRate: 'https://api.nbp.pl/api/exchangerates/rates/A/USD?format=JSON'
            },
            canPlaceOrder: false,
            popupModal: null,
            blikId: 150,
            exchangeBtcData: {
                id: null
            },
            blikSelected: ko.observable(false),
            transactionData: {
                blikSelected: false,
            },
            orderData: null,
            orderEvent: null,
            displayError: false,

            /**
             * Initialize view.
             *
             * @return {exports}
             */
            initialize: function () {
                this.isPlaceOrderActionAllowed(false);
                this.displayError = true;
                this._super();
                this._loadConfig();
                this.isPlaceOrderActionAllowed(true);
                this.displayError = false;

                this.getPaymentMethods();

                this.blikSelected.subscribe(function(value) {
                    this.transactionData.blikSelected = value;
                }, this);

                return this;
            },

            /**
             * @returns {boolean}
             */
            selectPaymentMethod: function () {
                this._super();
                this.getPaymentMethods();
                return true;
            },

            /**
             * @returns {Boolean}
             */
            isEnabled: function() {
                return !!this.config.is_enabled;
            },

            /**
             * @returns {String}
             */
            getPartnerId: function () {
                return this.config.partner_id;
            },

            /**
             * @returns {Boolean}
             */
            isSandbox: function () {
                return !!this.config.is_sandbox;
            },

            /**
             * @returns {String}
             */
            getBitcoinAddress: function () {
                return this.config.bitcoin_address;
            },

            /**
             * @returns {String}
             */
            getReturnUrl: function() {
                return url.build('kantor/order/success');
            },

            /**
             * @returns {Object}
             */
            getData: function () {
                return {
                    'method': this.getCode(),
                    'additional_data': {
                        'transaction_data': JSON.stringify(this.transactionData)
                    }
                };
            },

            /**
             * @param data
             * @param event
             * @param bitcanPayment
             * @returns {Boolean}
             */
            placeOrder: function (data, event, bitcanPayment = false) {
                let self = this;
                // reload sales data
                self._loadBtcData();
                if(bitcanPayment) {
                    this.transactionData.rate = this.exchangeBtcData.rate;
                    this.transactionData.amount = this.exchangeBtcData.amount;
                    return this._super(data, event);
                }
                this.orderData = data;
                this.orderEvent = event;
                this._initPopup('#bitcan_popup');
                this.popupModal.modal('openModal');

                $('#bitcan_popup').parent().parent().parent().addClass('modal-popup-bitcan');
            },

            afterPlaceOrder: function () {
                window.location.replace(this.transactionData.paymentUrl);
            },

            /**
             * @return {Boolean}
             */
            validate: function () {
                if(this.isSandbox()) {
                    return true;
                }

                return this.transactionData.hasOwnProperty('rate')
                    && this.transactionData.hasOwnProperty('amount')
                    && this.transactionData.hasOwnProperty('token')
                    && this.transactionData.hasOwnProperty('phoneNumber')
                    && this.transactionData.hasOwnProperty('blikSelected')
                    && this.transactionData.hasOwnProperty('estimation_id')
                    && this.transactionData.hasOwnProperty('code')
            },

            /**
             * @returns {String}
             */
            getOrderGrandTotal: function () {
                return priceUtils.formatPrice(quote.totals().grand_total, quote.getPriceFormat(), false);
            },

            /**
             * @returns {String}
             */
            getExchangePlnRate: function (format = false) {
                return format ?
                    priceUtils.formatPrice(
                        this.config.exchange_pln_rate,
                        {
                            decimalSymbol: ',',
                            groupLength: 3,
                            groupSymbol: '',
                            integerRequired: false,
                            pattern: '%s zł',
                            precision: 2,
                            requiredPrecision: 4
                        },
                        false) : this.config.exchange_pln_rate;
            },

            /**
             * @param {Boolean} format
             * @returns {Number|String}
             */
            getExchangeToPln: function (format = false) {
                if(format) {
                    return priceUtils.formatPrice(
                        quote.totals().grand_total * this.getExchangePlnRate(),
                        {
                            decimalSymbol: ',',
                            groupLength: 3,
                            groupSymbol: '',
                            integerRequired: false,
                            pattern: '%s zł',
                            precision: 2,
                            requiredPrecision: 2
                        },
                        false);
                }
                return quote.totals().grand_total * this.getExchangePlnRate();
            },

            /**
             * @param {String} type
             * @returns {String|Integer|Number}
             */
            getBtcData: function (type = 'rate') {
                try {
                    if(this.exchangeBtcData.id === null) {
                        this._loadBtcData();
                    }
                    if(type === 'rate') {
                        return priceUtils.formatPrice(
                            this.exchangeBtcData[type],
                            {
                                decimalSymbol: ',',
                                groupLength: 3,
                                groupSymbol: '',
                                integerRequired: false,
                                pattern: '%s zł',
                                precision: 2,
                                requiredPrecision: 2
                            },
                            false);
                    }
                    return this.exchangeBtcData[type];
                } catch(error) {
                }
            },

            /**
             * @param {String} stepId
             * @returns {boolean}
             */
            goToStep: function (stepId) {
                let self = this,
                    animating = false,
                    currentStep = $('.steps').find('.is-active'),
                    progressBar = $(`#progressbar li.${stepId}`),
                    stepElement = $('#' + stepId);

                if(animating) return false;
                animating = true;

                if(Number(stepId.substr(5,1)) < Number(currentStep.attr('id').substr(5,1))) {
                    $('#progressbar li').each(function(){
                        $(this).removeClass('is-active').removeClass('is-next');
                    });
                }

                progressBar.addClass('is-active').prevAll().addClass('is-active is-next');
                currentStep.animate({opacity: 0}, {
                    step: function (now, mx) {
                        let scale = 1 - (1 - now) * 0.2,
                            left = (now * 50)+"%",
                            opacity = 1 - now;

                        $(currentStep).css({
                            transform: `scale(${scale})`,
                            position: 'absolute'
                        });
                        stepElement.css({'transform': 'scale('+1+')', 'left': left, 'opacity': opacity, 'position': 'relative'});
                    },
                    complete: function(){
                        currentStep.removeClass('is-active');
                        animating = false;
                    },
                    duration: 400,
                    easing: 'easeInOutBack',
                });

                setTimeout(function () {
                    stepElement.addClass('is-active');
                    if(stepId === 'step-2') {
                        if(!self.isSandbox()) {
                            grecaptcha.reset();
                        }
                        stepElement.find('input#phone_number').focus();
                    }

                    if(stepId === 'step-3') {
                        stepElement.find('input#sms_code').focus();
                    }
                }, 450);
            },

            autoFormatPhoneNumber: function (element) {
                let backspacePressedLast = false;

                $(element).on('keydown', function (e) {
                    let currentKey = e.which;

                    backspacePressedLast = currentKey === 8 || currentKey === 46;
                }).on('input', function(e) {
                    if (backspacePressedLast) return;
                    let $this = $(e.currentTarget),
                        currentValue = $this.val(),
                        newValue = currentValue.replace(/\D+/g, ''),
                        formattedValue = formatToTelephone(newValue);

                    $this.val(formattedValue);
                });

                function formatToTelephone(str) {
                    let splitString = str.split(''),
                        returnValue = '';

                    for (let i = 0; i < splitString.length; i++) {
                        let currentCharacter = splitString[i];

                        switch (i) {
                            case 0:
                                returnValue = returnValue.concat(currentCharacter);
                                break;
                            case 2:
                                returnValue = returnValue.concat(currentCharacter);
                                returnValue = returnValue.concat('-');
                                break;
                            case 5:
                                returnValue = returnValue.concat(currentCharacter);
                                returnValue = returnValue.concat('-');
                                break;
                            default:
                                returnValue = returnValue.concat(currentCharacter);
                        }
                    }
                    return returnValue;
                }
            },

            autoFormatSmsCode: function (element) {
                let backspacePressedLast = false;

                $(element).on('keydown', function (e) {
                    let currentKey = e.which;

                    backspacePressedLast = currentKey === 8 || currentKey === 46;
                }).on('input', function(e) {
                    if (backspacePressedLast) return;
                    let $this = $(e.currentTarget),
                        currentValue = $this.val(),
                        newValue = currentValue.replace(/\D+/g, ''),
                        formattedValue = formatSmsCode(newValue);

                    $this.val(formattedValue);
                });

                function formatSmsCode(str) {
                    let splitString = str.split(''),
                        returnValue = '';

                    for (let i = 0; i < splitString.length; i++) {
                        let currentCharacter = splitString[i];

                        switch (i) {
                            case 0:
                                returnValue = returnValue.concat(currentCharacter);
                                break;
                            case 2:
                                returnValue = returnValue.concat(currentCharacter);
                                returnValue = returnValue.concat('-');
                                break;
                            default:
                                returnValue = returnValue.concat(currentCharacter);
                        }
                    }
                    return returnValue;
                }
            },

            countDownTime: function () {
                const $resendCodeLink = $('.js-bitcan-resend-code'),
                    $timer = $('.js-bitcan-timer');
                $("#bitcan-counter-info").css('display', 'inherit');

                $resendCodeLink.addClass('disabled');
                $resendCodeLink.attr('disabled', true);

                let $this = $timer,
                    time = $this.attr('data-time'),
                    countSeconds = $this.attr('data-seconds');

                $this.text(time);

                $({countAmt: $this.text()}).animate({
                        countAmt: countSeconds
                    },
                    {
                        duration: time * 1000, //120s
                        easing:'linear',
                        step: function() {
                            $this.text(Math.floor(this.countAmt));
                        },
                        complete: function() {
                            $("#bitcan-counter-info").css('display', 'none');
                            $resendCodeLink.removeClass('disabled');
                            $resendCodeLink.removeAttr('disabled');
                            $this.text(this.countAmt);
                        }
                    });
            },

            /**
             * @param {HTMLElement} element
             */
            renderReCaptcha: function (element) {
                if(!this.isSandbox()) {
                    let recaptcha = document.createElement('div');
                    recaptcha.id = 'recaptcha';
                    recaptcha.style = 'display: flex;justify-content: center;align-items: center;';

                    grecaptcha.render(recaptcha, {
                        'sitekey' : this.config.re_captcha,
                        'theme' : 'light'
                    });

                    element.insertBefore(recaptcha, $(element).children('.bitcan__step-actions')[0]);
                }
            },

            /**
             * @returns {Array}
             */
            getPaymentMethods: function () {
                let self = this,
                    paymentMethods = [],
                    url = this._format(this.host + this.endpoints.paymentMethods);

                $.ajax({
                    url: url,
                    type: 'GET',
                    async: false
                }).done(function (data){
                    for(let i in data) {
                        let payment = data[i],
                            orderInPln = Number(Math.round(Math.abs(+quote.totals().grand_total * self.getExchangePlnRate() || 0) + 'e+' + 2) + ('e-' + 2));

                        if(payment.maximum > orderInPln && payment.minimum < orderInPln) {
                            paymentMethods.push(payment);
                        }
                    }
                });

                if(paymentMethods.length === 0) {
                    this.canPlaceOrder = false;
                    this.displayError = true;
                } else {
                    this.canPlaceOrder = true;
                }

                return paymentMethods;
            },

            /**
             * @param {String} element
             */
            _initPopup: function (element) {
                let self = this;
                if(self.popupModal === null) {
                    self.popupModal = $(element);

                    self.popupModal.modal({
                        responsive: true,
                        clickableOverlay: true,
                        innerScroll: true,
                        buttons: [{
                            text: $t('Cancel'),
                            class: '',
                            click: function () {
                                this.closeModal();
                                self._cancelPayment();
                            }
                        }]
                    });

                    self.popupModal.find('input').on('focus', function () {
                        self._clearError(this);
                    });
                }
            },

            closePopup: function () {
                this.popupModal.modal('closeModal');
                this._cancelPayment();
            },

            /**
             * @param {HTMLElement} element
             * @returns {Boolean}
             * @private
             */
            _submitSMSCode: function (element) {
                let self = this,
                    phoneNumber = $('#phone_number').val().replace(/-/g, '');
                self.countDownTime();

                if(phoneNumber === undefined
                    || phoneNumber === ''
                    || phoneNumber.match(/\d/g) === null
                    || phoneNumber.match(/\d/g).length !== 9) {
                    self._displayError(element, 'Incorrect phone number. Example: 123-123-123');
                    if(!self.isSandbox()) {
                        grecaptcha.reset();
                    }
                    return false;
                }
                self.transactionData.phoneNumber = phoneNumber;
                self._clearError(element);

                let data = {
                    phone: `+48${phoneNumber}`,
                };

                if(self.isSandbox()) {
                    data.sandbox = 'yes';
                } else {
                    if(grecaptcha.getResponse() === '') {
                        self._displayError(element, 'Check the box "I am not a robot"');
                        return false;
                    }
                    data['g-recaptcha-response'] = grecaptcha.getResponse();
                }

                self._clearError(element);
                $.ajax({
                    url: self.host + self.endpoints.authenticationStart,
                    type: 'POST',
                    data: JSON.stringify(data),
                    headers: {
                        'Content-Type': 'application/json;'
                    }
                }).done(function () {
                    if(self.isSandbox()) {
                        $.ajax({
                            url: self.host + self.endpoints.authenticationToken,
                            type: 'POST',
                            data: JSON.stringify({
                                phone: `+48${phoneNumber}`,
                                code: "000-000"
                            }),
                            async: false,
                            headers: {
                                'Content-Type': 'application/json;'
                            }
                        }).done(function (data) {
                            self.transactionData.token = data.token;
                            self.goToStep('step-4');
                        });
                    } else {
                        self.goToStep('step-3');
                    }
                }).fail(function(data){
                    self._displayError(element, data.responseJSON.message);
                    if(!self.isSandbox()) {
                        grecaptcha.reset();
                    }
                });
            },

            /**
             * @param {HTMLElement} element
             * @returns {Boolean}
             * @private
             */
            _verifySMSCode: function (element) {
                let self = this,
                    smsCode = $('#sms_code').val();

                if(self.isSandbox()) {
                    return false;
                }

                if(smsCode === undefined || smsCode === '') {
                    self._displayError(element, 'Incorrect SMS Code.');
                    return false;
                }
                self._clearError(element);

                $.ajax({
                    url: self.host + self.endpoints.authenticationToken,
                    type: 'POST',
                    data: JSON.stringify({
                        phone: `+48${self.transactionData.phoneNumber}`,
                        code: smsCode
                    }),
                    headers: {
                        'Content-Type': 'application/json;'
                    }
                }).done(function (data) {
                    self.transactionData.token = data.token;
                    self.goToStep('step-4');
                }).fail(function () {
                    self._displayError(element, 'Incorrect SMS Code.');
                });

            },

            /**
             * @param {HTMLElement} element
             * @private
             */
            _selectPaymentMethod: function (element) {
                let self = this,
                    paymentMethodId = Number($(element).attr('data-id')),
                    billingAddress = quote.billingAddress();

                $(element).parent().find('.payment_method').removeClass('selected-payment-method');
                $(element).addClass('selected-payment-method');

                let data = {
                    token: self.transactionData.token,
                    name: `${billingAddress.firstname} ${billingAddress.lastname}`,
                    email: checkoutData.getValidatedEmailValue(),
                    address: self.getBitcoinAddress(),
                    payment_method: String(paymentMethodId),
                    blik: null,
                    amount: Number(Math.round(Math.abs(+quote.totals().grand_total * self.getExchangePlnRate() || 0) + 'e+' + 2) + ('e-' + 2)),
                    partner_id: self.getPartnerId(),
                    nh_attempt_id: window.BCWidget.uuidv4(),
                    estimation_id: null,
                    return_url: self.getReturnUrl()
                };

                $(element).parent().find('.loader').css('display', 'inherit');

                if(paymentMethodId === self.blikId) {
                    self.blikSelected(true);
                    self.redirectAfterPlaceOrder = true;
                    if (self.isSandbox()) {
                        data.blik = 'BLIK_POSITIVE';
                    } else {
                        self.goToStep('step-5');
                        return;
                    }
                } else {
                    self.redirectAfterPlaceOrder = false;
                }

                $.ajax({
                    url: self.host + self.endpoints.transaction,
                    type: 'POST',
                    data: JSON.stringify(data),
                    headers: {
                        'Content-Type': 'application/json;'
                    },
                }).done(function (data) {
                    self.transactionData.code = data.code;

                    if(paymentMethodId === self.blikId && self.isSandbox()) {
                        self.goToStep('step-8');
                        self.placeOrder(self.orderData, self.orderEvent, true);
                        return;
                    }

                    if(data.kyc_needed) {
                        let iframe = document.createElement('iframe'),
                            kycDiv = $('#kyc_verification');
                        iframe.src = data.kyc_src;
                        iframe.width = '100%';
                        iframe.height = '480px';
                        iframe.allow = 'camera;fullscreen';
                        iframe.allowfullscreen = 'true';
                        iframe.frameborder = '0';

                        kycDiv.children('.loader').css('display', 'none');
                        kycDiv.append(iframe);
                        kycDiv.css('height', 'inherit');

                        if (window.addEventListener) {
                            window.addEventListener('message', function(event) {
                                let data = JSON.parse(event.data);
                                if (data.payload.value === 'success') {
                                    self._verifyPayment();
                                    self.goToStep('step-8');
                                }
                            }, false);
                        } else {
                            window.attachEvent('onmessage', function(event) {
                                let data = JSON.parse(event.data);
                                if (data.payload.value === 'success') {
                                    self._verifyPayment();
                                    self.goToStep('step-8');
                                }
                            });
                        }
                        self.goToStep('step-7');
                    } else {
                        self._verifyPayment();
                        self.goToStep('step-8');
                    }
                }).fail(function (data) {
                    self.exchangeBtcData.id = null;
                    self._displayError(element, data.responseJSON.message);
                }).always(function (){
                    $(element).parent().find('.loader').css('display', 'none');
                });
            },

            /**
             * @private
             */
            _verifyPayment: function () {
                let self = this,
                    url = self._format(self.host + self.endpoints.transactionVerification, {code: self.transactionData.code}),
                    response = null;

                $.ajax({
                    url: url,
                    type: 'GET',
                    headers: {
                        'Content-Type': 'application/json;'
                    },
                    async: false
                }).done(function (data) {
                    response = data;
                }).fail(function(data) {
                    let div = $('#payment');
                    div.children('button').show();
                    div.children('.error').children('span').text(data.responseJSON.message);
                });

                if(response !== null) {
                    if(self.blikSelected() && response.paid === 'PROCESSING') {
                        setTimeout(function () {
                            self._verifyPayment();
                        }, 10000);
                    }

                    if(self.blikSelected() && response.paid === 'APPROVED') {
                        self.placeOrder(self.orderData, self.orderEvent, true);
                        return;
                    }

                    if(response.verified === 'PROCESSING') {
                        setTimeout(function () {
                            self._verifyPayment();
                        }, 10000);
                    }

                    if(response.verified === 'APPROVED') {
                        self.transactionData.paymentUrl = response.payment_url;
                        self.placeOrder(self.orderData, self.orderEvent, true);
                        return;
                    }

                    if(response.verified === 'REJECTED') {
                        let div = $('#payment');
                        div.children('button').show();
                        div.children('.error').children('span').text(response.reject_reason);
                    }
                }
            },

            /**
             * @param {HTMLElement} element
             * @returns {Boolean}
             * @private
             */
            _submitBlikCode: function (element) {
                let self = this,
                    blikCode = $('#blik_code').val(),
                    billingAddress = quote.billingAddress();

                if(blikCode === undefined
                    || blikCode === ''
                    || blikCode.match(/\d/g) === null
                    || blikCode.match(/\d/g).length !== 6) {
                    self._displayError(element, 'Incorrect BLIK code. Make sure you entered code correctly');
                    return false;
                }
                self._clearError(element);

                let data = {
                    token: self.transactionData.token,
                    name: `${billingAddress.firstname} ${billingAddress.lastname}`,
                    email: checkoutData.getValidatedEmailValue(),
                    address: self.getBitcoinAddress(),
                    payment_method: self.blikId,
                    blik: blikCode,
                    nh_attempt_id: window.BCWidget.uuidv4(),
                    amount: Number(Math.round(Math.abs(+quote.totals().grand_total * self.getExchangePlnRate() || 0) + 'e+' + 2) + ('e-' + 2)),
                    partner_id: self.getPartnerId(),
                    estimation_id: null,
                    return_url: self.getReturnUrl()
                };

                $(element).parent().parent().children('.loader').css('display', 'inherit');

                $.ajax({
                    url: self.host + self.endpoints.transaction,
                    type: 'POST',
                    data: JSON.stringify(data),
                    headers: {
                        'Content-Type': 'application/json;'
                    }
                }).done(function (data) {
                    self.transactionData.code = data.code;
                    self._verifyPayment();
                    self.goToStep('step-8');
                }).fail(function(data) {
                    self._displayError(element, data.responseJSON.message);
                    self.exchangeBtcData.id = null;
                }).always(function () {
                    $(element).parent().parent().children('.loader').css('display', 'none');
                });
            },

            /**
             * @private
             */
            _loadBtcData: function () {
                let self = this,
                    orderValueInPln = Number(Math.round(Math.abs(self.getExchangeToPln() || 0) + 'e+' + 2) + ('e-' + 2)),
                    url = self._format(self.host + self.endpoints.convertToBtc, {amount: orderValueInPln});

                $.ajax({
                    url: url,
                    async: false
                }).done(function (data) {
                    self.exchangeBtcData = {
                        rate: data.buy,
                        amount: data.buy_estimation,
                        id: data.buy_estimation_id
                    };
                    self.transactionData.estimation_id = data.buy_estimation_id;
                });
            },

            /**
             * @private
             */
            _cancelPayment: function () {
                this.exchangeBtcData.id = null;
                this._clearPopup();
            },

            /**
             * @private
             */
            _clearPopup: function () {

                // revert progress bar to step-1
                let $progressBar = $('#progressbar li');
                let $steps = $('.step');
                $progressBar.each(function() {
                    $(this).removeClass('is-active').removeClass('is-next');
                });
                $progressBar.eq(0).addClass('is-active');
                $progressBar.eq(1).addClass('is-next');

                // revert to step-1
                $steps.each(function (e) {
                    $(this).removeClass('is-active').removeAttr('style');
                });

                $('#step-1').addClass('is-active');

                // clear inputs values
                $(this.popupModal).find('input').each(function () {
                    $(this).val('');
                });

                // clear all errors
                $(this.popupModal).find('.error span').each(function () {
                    $(this).text('');
                });

                // clear selected payment method
                $(this.popupModal).find('.payment_method').each(function () {
                    $(this).removeClass('.selected-payment-method');
                });

                // clear transaction data
                this.transactionData = {};

                // remove iframe and revert loader
                let kycDiv = $('#kyc_verification');
                kycDiv.find('iframe').remove();
                kycDiv.children('.loader').css('display', 'inherit');
                kycDiv.css('height', '480px');

                // remove css for selected payment method
                $(this.popupModal).find('.payment_method').removeClass('selected-payment-method');
            },

            /**
             * @param {HTMLElement|String} element
             * @param {String} text
             * @private
             */
            _displayError: function (element, text) {
                $(element).parent().parent().children('.error').children('span').text($t(text));
            },

            /**
             * @param {HTMLElement} element
             * @private
             */
            _clearError: function (element) {
                $(element).parent().parent().children('.error').children('span').empty();
            },

            /**
             * @private
             */
            _loadConfig: function() {
                this.config = window.checkoutConfig.payment.bitcan;
                this.endpoints.variables.partner_id = this.config.partner_id;
            },

            /**
             * @param {String} pattern
             * @param {Array} args
             * @returns {String}
             * @private
             */
            _format: function (pattern, args = []) {
                args = {
                    ...args,
                    ...this.endpoints.variables
                };

                for (let k in args) {
                    pattern = pattern.replace('${' + k + '}', args[k])
                }
                return pattern
            },

            /**
             * @returns {String}
             */
            getEstimationId: function () {
                if(this.getBtcData('id') == null) {
                    this._loadBtcData();
                }

                return this.getBtcData('id');
            },
        });
    }
);
