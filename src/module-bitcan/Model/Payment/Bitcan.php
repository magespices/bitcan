<?php
/**
 * Created by Q-Solutions Studio
 * Date: 29.07.2020
 *
 * @category    Magespices
 * @package     Magespices_Bitcan
 * @author      Maciej Buchert <maciej@qsolutionsstudio.com>
 */

namespace Magespices\Bitcan\Model\Payment;

use Magento\Payment\Model\Method\AbstractMethod;

/**
 * Class Bitcan
 * @package Magespices\Bitcan\Model\Payment
 */
class Bitcan extends AbstractMethod
{
    /** @var string */
    const PAYMENT_METHOD_BITCAN_CODE = 'bitcan';

    /**
     * @var string
     */
    protected $_code = self::PAYMENT_METHOD_BITCAN_CODE;

    /**
     * @var bool
     */
    protected $_isOffline = true;

    /**
     * @param $currencyCode
     * @return bool
     */
    public function canUseForCurrency($currencyCode)
    {
        return $currencyCode === 'PLN';
    }
}