<?php
/**
 * Created by Q-Solutions Studio
 * Date: 03.08.2020
 *
 * @category    Magespices
 * @package     Magespices_Bitcan
 * @author      Maciej Buchert <maciej@qsolutionsstudio.com>
 */

namespace Magespices\Bitcan\Model;

use Magento\Checkout\Model\ConfigProviderInterface;
use Magespices\Bitcan\Helper\Data;

/**
 * Class ConfigProvider
 * @package Magespices\Bitcan\Model
 */
class ConfigProvider implements ConfigProviderInterface
{
    /**
     * @var Data
     */
    protected $helper;

    /**
     * ConfigProvider constructor.
     * @param Data $helper
     */
    public function __construct(Data $helper)
    {
        $this->helper = $helper;
    }

    /**
     * @return array
     */
    public function getConfig(): array
    {
        $config['payment'] = [
            'bitcan' => [
                'is_enabled' => $this->helper->isEnabled(),
                'is_sandbox' => (bool)$this->helper->getConfigValue(Data::PAYMENT_BITCAN_SANDBOX_XPATH),
                'partner_id' => $this->helper->getConfigValue(Data::PAYMENT_BITCAN_PARTNER_ID_XPATH),
                'bitcoin_address' => $this->helper->getConfigValue(Data::PAYMENT_BITCAN_BITCOIN_ADDRESS_XPATH),
                're_captcha' => $this->helper->getConfigValue(Data::PAYMENT_BITCAN_RE_CAPTCHA_XPATH),
                'exchange_pln_rate' => (float)$this->helper->getConfigValue(Data::NBP_CONFIG_EXCHANGE_RATE)
            ]
        ];

        return $config;
    }
}