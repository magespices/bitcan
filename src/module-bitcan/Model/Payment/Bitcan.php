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

use Magento\Customer\Model\SessionFactory;
use Magento\Directory\Helper\Data as DirectoryHelper;
use Magento\Framework\Api\AttributeValueFactory;
use Magento\Framework\Api\ExtensionAttributesFactory;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\Data\Collection\AbstractDb;
use Magento\Framework\Model\Context;
use Magento\Framework\Model\ResourceModel\AbstractResource;
use Magento\Framework\Registry;
use Magento\Payment\Helper\Data;
use Magento\Payment\Model\Method\AbstractMethod;
use Magento\Payment\Model\Method\Logger;

/**
 * Class Bitcan
 * @package Magespices\Bitcan\Model\Payment
 */
class Bitcan extends AbstractMethod
{
    /** @var string */
    public const PAYMENT_CODE = 'bitcan';

    /**
     * @var SessionFactory
     */
    protected $customerSessionFactory;

    /**
     * @var string
     */
    protected $_code = self::PAYMENT_CODE;

    /**
     * @var bool
     */
    protected $_isOffline = true;

    /**
     * Bitcan constructor.
     * @param Context $context
     * @param Registry $registry
     * @param ExtensionAttributesFactory $extensionFactory
     * @param AttributeValueFactory $customAttributeFactory
     * @param Data $paymentData
     * @param ScopeConfigInterface $scopeConfig
     * @param Logger $logger
     * @param AbstractResource|null $resource
     * @param AbstractDb|null $resourceCollection
     * @param array $data
     * @param DirectoryHelper|null $directory
     */
    public function __construct(
        Context $context,
        Registry $registry,
        ExtensionAttributesFactory $extensionFactory,
        AttributeValueFactory $customAttributeFactory,
        Data $paymentData,
        ScopeConfigInterface $scopeConfig,
        Logger $logger,
        SessionFactory $customerSessionFactory,
        AbstractResource $resource = null,
        AbstractDb $resourceCollection = null,
        array $data = [],
        DirectoryHelper $directory = null
    ) {
        $this->customerSessionFactory = $customerSessionFactory;
        parent::__construct($context, $registry, $extensionFactory, $customAttributeFactory, $paymentData, $scopeConfig,
            $logger, $resource, $resourceCollection, $data, $directory);
    }

    public function canUseForCountry($country)
    {
        $customer = $this->customerSessionFactory->create()->getCustomer();
        if((bool)$customer->getDefaultBillingAddress()) {
            $countryId = $customer->getDefaultBillingAddress()->getCountryId();
        } else {
            $countryId = $customer->getData('country_id');
        }
        if ((int)$this->getConfigData('allowspecific') === 1) {
            $availableCountries = explode(',', $this->getConfigData('specificcountry'));
            if (!in_array($countryId, $availableCountries, true)) {
                return false;
            }
        }
        return true;
    }
}

