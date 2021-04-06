<?php
/**
 * Created by Q-Solutions Studio
 * Date: 12.08.2020
 *
 * @category    Magespices
 * @package     Magespices_Bitcan
 * @author      Maciej Buchert <maciej@qsolutionsstudio.com>
 */

namespace Magespices\Bitcan\Observer;

use Magento\Framework\Event\Observer;
use Magento\Payment\Observer\AbstractDataAssignObserver;
use Magento\Quote\Api\Data\PaymentInterface;
use Psr\Log\LoggerInterface;

/**
 * Class AssignAdditionalInformation
 * @package Magespices\Bitcan\Observer
 */
class AssignAdditionalInformation extends AbstractDataAssignObserver
{
    /** @var string */
    public const TRANSACTION_DATA_KEY = 'transaction_data';

    /**
     * @var string[]
     */
    protected $additionalInformationList = [
        self::TRANSACTION_DATA_KEY,
    ];
    /**
     * @var LoggerInterface
     */
    protected $logger;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    /**
     * @inheritDoc
     */
    public function execute(Observer $observer): void
    {
        $data = $this->readDataArgument($observer);
        $additionalData = $data->getData(PaymentInterface::KEY_ADDITIONAL_DATA);

        if(is_array($additionalData)) {
            $paymentInfo = $this->readPaymentModelArgument($observer);
            foreach ($this->additionalInformationList as $additionalInformationKey) {
                $additionalInformation = $paymentInfo->getAdditionalInformation();
                $additionalInformation[$additionalInformationKey] = json_decode($additionalData[$additionalInformationKey]);
                $paymentInfo->setAdditionalInformation($additionalInformation);
            }
        }
    }
}