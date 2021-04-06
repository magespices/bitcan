<?php
/**
 * Created by Q-Solutions Studio
 * Date: 12.08.2020
 *
 * @category    Magespices
 * @package     Magespices_Bitcan
 * @author      Maciej Buchert <maciej@qsolutionsstudio.com>
 */

namespace Magespices\Bitcan\Controller\Order;

use Magento\Framework\App\Action\Context;
use Magento\Framework\Controller\Result\Redirect;
use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Framework\View\Result\PageFactory;
use Magento\Framework\App\Action\Action;
use Magento\Sales\Api\Data\OrderInterface;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\OrderFactory;
use Magento\Sales\Model\OrderRepository;
use Magento\Sales\Model\ResourceModel\Order as OrderResourceModel;
use Magento\Sales\Model\ResourceModel\Order\CollectionFactory as OrderCollectionFactory;
use Magespices\Bitcan\Helper\Data;

/**
 * Class Index
 * @package Magespices\Bitcan\Controller\Order\Index
 */
class Success extends Action
{
    /** @var string */
    public const TRANSACTION_PARAMETER = '_btid';

    /**
     * Index resultPageFactory
     * @var PageFactory
     */
    protected $resultPageFactory;

    /**
     * @var Data
     */
    protected $helper;

    /**
     * @var OrderCollectionFactory
     */
    protected $_orderCollectionFactory;

    /**
     * @var OrderFactory
     */
    protected $orderFactory;

    /**
     * @var OrderResourceModel
     */
    protected $orderResourceModel;

    /**
     * @var OrderRepository
     */
    protected $orderRepository;

    /**
     * Success constructor.
     * @param Context $context
     * @param PageFactory $resultPageFactory
     * @param Data $helper
     * @param OrderCollectionFactory $orderCollectionFactory
     * @param OrderFactory $orderFactory
     * @param OrderResourceModel $orderResourceModel
     * @param OrderRepository $orderRepository
     */
    public function __construct(
        Context $context,
        PageFactory $resultPageFactory,
        Data $helper,
        OrderCollectionFactory $orderCollectionFactory,
        OrderFactory $orderFactory,
        OrderResourceModel $orderResourceModel,
        OrderRepository $orderRepository
    )
    {
        $this->helper = $helper;
        $this->resultPageFactory = $resultPageFactory;
        $this->_orderCollectionFactory = $orderCollectionFactory;
        $this->orderFactory = $orderFactory;
        $this->orderResourceModel = $orderResourceModel;
        $this->orderRepository = $orderRepository;
        parent::__construct($context);
    }

    /**
     * @return Redirect
     */
    public function execute(): Redirect
    {
        $redirect = $this->resultRedirectFactory->create();
        $transactionId = $this->getRequest()->getParam(static::TRANSACTION_PARAMETER);
        if($transactionId) {
            $order = $this->getOrderByTransactionId($transactionId);
            if($order) {
                $this->helper->checkAndUpdateTransaction($order, false);
                return $redirect->setPath('checkout/onepage/success');
            }
            return $redirect->setPath('sales/order/history');
        }
        return $redirect->setPath('/');
    }

    /**
     * @param string $transactionId
     * @return OrderInterface|null
     * @throws InputException
     * @throws NoSuchEntityException
     */
    protected function getOrderByTransactionId(string $transactionId): ?OrderInterface
    {
        $order = null;
        $orders = $this->_orderCollectionFactory->create();
        $orders->addFieldToFilter(Order::STATUS, 'pending')
            ->setOrder('entity_id', 'DESC');

        /** @var Order $order */
        foreach($orders as $order) {
            if($order->getPayment() && $this->checkOrderTransactionId($order, $transactionId)) {
                $order = $this->orderRepository->get($order->getId());
                break;
            }
        }

        return $order;
    }

    /**
     * @param Order $order
     * @param string $transactionId
     * @return bool
     */
    protected function checkOrderTransactionId(Order $order, string $transactionId): bool
    {
        if($order->getPayment()) {
            $additionalInformation = $order->getPayment()->getAdditionalInformation();

            if(isset($additionalInformation['transaction_data']['code']) && $additionalInformation['transaction_data']['code'] === $transactionId) {
                return true;
            }
        }
        return false;
    }
}
