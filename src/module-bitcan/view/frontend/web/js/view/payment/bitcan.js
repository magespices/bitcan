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
        'uiComponent',
        'Magento_Checkout/js/model/payment/renderer-list'
    ],
    function (
        Component,
        rendererList
    ) {
        'use strict';
        rendererList.push(
            {
                type: 'bitcan',
                component: 'Magespices_Bitcan/js/view/payment/method-renderer/bitcan-method'
            }
        );
        return Component.extend({});
    }
);