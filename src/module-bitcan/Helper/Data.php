<?php
/**
 * Created by Q-Solutions Studio
 * Date: 03.08.2020
 *
 * @category    Magespices
 * @package     Magespices_Bitcan
 * @author      Maciej Buchert <maciej@qsolutionsstudio.com>
 */

namespace Magespices\Bitcan\Helper;

use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\App\Config\Storage\WriterInterface;
use Magento\Framework\App\Helper\AbstractHelper;
use Magento\Framework\App\Helper\Context;
use Magento\Framework\Stdlib\DateTime\DateTime;
use Magento\Framework\Stdlib\DateTime\Timezone;
use Magento\Sales\Api\Data\OrderInterface;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\OrderRepository;
use Magento\Sales\Model\ResourceModel\Order as OrderResourceModel;

/**
 * Class Data
 * @package Magespices\Bitcan\Helper
 */
class Data extends AbstractHelper
{
    /** @var string */
    public const PAYMENT_BITCAN_ACTIVE_XPATH = 'payment/bitcan/active';

    /** @var string */
    public const PAYMENT_BITCAN_TITLE_XPATH = 'payment/bitcan/title';

    /** @var string */
    public const PAYMENT_BITCAN_ORDER_STATUS_XPATH = 'payment/bitcan/order_status';

    /** @var string */
    public const PAYMENT_BITCAN_ALLOWSPECIFIC_XPATH = 'payment/bitcan/allowspecific';

    /** @var string */
    public const PAYMENT_BITCAN_SPECIFICCOUNTRY_XPATH = 'payment/bitcan/specificcountry';

    /** @var string */
    public const PAYMENT_BITCAN_SANDBOX_XPATH = 'payment/bitcan/sandbox';

    /** @var string */
    public const PAYMENT_BITCAN_PARTNER_ID_XPATH = 'payment/bitcan/partner_id';

    /** @var string */
    public const PAYMENT_BITCAN_BITCOIN_ADDRESS_XPATH = 'payment/bitcan/bitcoin_address';

    /** @var string */
    public const PAYMENT_BITCAN_SORT_ORDER_XPATH = 'payment/bitcan/sort_order';

    /** @var string */
    public const PAYMENT_BITCAN_RE_CAPTCHA_XPATH = 'payment/bitcan/re_captcha';

    /** @var string */
    public const TRANSACTION_STATUS_URL = 'https://api.bitcan.pl/widget/transactions/%s';

    /** @var string */
    public const NPB_EXCHANGE_DATA_URL = 'https://api.nbp.pl/api/exchangerates/rates/A/USD?format=JSON';

    /** @var string */
    public const NBP_CONFIG_EXCHANGE_RATE = 'payment/bitcan/nbp_exchange_rate';

    /** @var string */
    public const NBP_CONFIG_EXCHANGE_TIMESTAMP = 'payment/bitcan/nbp_exchange_timestamp';

    /**
     * @var OrderResourceModel
     */
    protected $orderResourceModel;

    /**
     * @var OrderRepository
     */
    protected $orderRepository;

    /**
     * @var WriterInterface
     */
    protected $writer;

    /**
     * @var Timezone
     */
    protected $timezone;

    /**
     * @var DateTime
     */
    protected $date;

    /**
     * Data constructor.
     * @param Context $context
     * @param OrderResourceModel $orderResourceModel
     * @param OrderRepository $orderRepository
     * @param WriterInterface $writer
     * @param Timezone $timezone
     * @param DateTime $date
     */
    public function __construct(
        Context $context,
        OrderResourceModel $orderResourceModel,
        OrderRepository $orderRepository,
        WriterInterface $writer,
        Timezone $timezone,
        DateTime $date
    ) {
        $this->orderResourceModel = $orderResourceModel;
        $this->orderRepository = $orderRepository;
        $this->writer = $writer;
        $this->timezone = $timezone;
        $this->date = $date;
        parent::__construct($context);
    }

    /**
     * @return bool
     */
    public function isEnabled(): bool
    {
        return $this->scopeConfig->isSetFlag(self::PAYMENT_BITCAN_ACTIVE_XPATH);
    }

    /**
     * @param string $path
     * @param string $scopeType
     * @param string|null $scopeCode
     * @return mixed
     */
    public function getConfigValue(
        string $path,
        string $scopeType = ScopeConfigInterface::SCOPE_TYPE_DEFAULT,
        string $scopeCode = null
    ) {
        return $this->scopeConfig->getValue($path, $scopeType, $scopeCode);
    }

    /**
     * @param OrderInterface $order
     * @param bool $canCancel
     */
    public function checkAndUpdateTransaction(OrderInterface $order, $canCancel = true): void
    {
        if(!$order->getPayment()) {
            return;
        }

        $additionalInformation = $order->getPayment()->getAdditionalInformation();
        if(!isset($additionalInformation['transaction_data']['code'])) {
            return;
        }

        $transactionStatus = $this->checkTransactionStatus($additionalInformation['transaction_data']['code']);

        if($transactionStatus['status'] === 'error') {
            if ($canCancel
                && in_array($order->getState(), [Order::STATE_NEW, Order::STATE_PROCESSING], true)
                && $order->getCreatedAt() <= date('Y-m-d H:i:s', strtotime('-48 hours', strtotime($this->date->gmtDate()))))
            {
                $order->cancel();
                $this->updateOrder($order, null, sprintf('Bitcan update. Payment canceled. Code: %s', $transactionStatus['code']));
            }
        } else {
            switch ($transactionStatus['paid']) {
                case 'PROCESSING':
                    if($order->getState() === Order::STATE_NEW) {
                        $this->updateOrder($order, Order::STATE_PROCESSING,'Bitcan update. Payment is processing');
                    }
                    break;
                case 'PAID':
                    if(in_array($order->getState(), [Order::STATE_NEW, Order::STATE_PROCESSING], true)) {
                        $order->getPayment()->setAmountPaid($order->getBaseGrandTotal());
                        $order->getPayment()->setBaseAmountPaid($order->getBaseGrandTotal());
                        $order->setTotalPaid($order->getBaseGrandTotal());
                        $order->setBaseTotalPaid($order->getBaseGrandTotal());
                        $this->updateOrder($order, Order::STATE_COMPLETE,'Bitcan update. Payment complete');
                    }
                    break;
                case 'UNPAID':
                    if ($canCancel
                        && in_array($order->getState(), [Order::STATE_NEW, Order::STATE_PROCESSING], true)
                        && $order->getCreatedAt() <= date('Y-m-d H:i:s', strtotime('-48 hours', strtotime($this->date->gmtDate()))))
                    {
                        $order->cancel();
                        $this->updateOrder($order, null, 'Bitcan update. Payment time has expired');
                    }
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * @param string $transactionId
     * @return array
     */
    public function checkTransactionStatus(string $transactionId): array
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_URL, sprintf(self::TRANSACTION_STATUS_URL, $transactionId));
        $response = curl_exec($ch);
        curl_close($ch);

        return json_decode($response, true);
    }

    /**
     * @param Order $order
     * @param string|null $state
     * @param string|null $comment
     */
    protected function updateOrder(OrderInterface $order, string $state = null, string $comment = null): void
    {
        if($state !== null) {
            if($state === Order::STATE_COMPLETE) {
                $order->addStatusToHistory(Order::STATE_COMPLETE, $comment, false);
            }
            $order->setState($state);
            $order->setStatus($state);
        }

        if($comment !== null && $state !== Order::STATE_COMPLETE) {
            $order->addCommentToStatusHistory($comment);
        }

        try {
            $this->orderResourceModel->save($order);
        } catch (\Exception $exception) {
            $this->_logger->error($exception->getMessage());
        }
    }


    public function updateExchangeRate(): void
    {
        try {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            curl_setopt($ch, CURLOPT_URL, static::NPB_EXCHANGE_DATA_URL);
            $response = json_decode(curl_exec($ch), true);
            curl_close($ch);

            if(isset($response['rates'][0]['mid'])) {
                $this->writer->save(static::NBP_CONFIG_EXCHANGE_RATE, $response['rates'][0]['mid']);
                $this->writer->save(static::NBP_CONFIG_EXCHANGE_TIMESTAMP, $this->timezone->date()->getTimestamp());
            }
        } catch (\Exception $exception) {
            $this->_logger->error($exception->getMessage());
        }

    }
}