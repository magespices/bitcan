<?php
/**
 * Created by Q-Solutions Studio
 * Date: 13.08.2020
 *
 * @category    Magespices
 * @package     Magespices_Bitcan
 * @author      Maciej Buchert <maciej@qsolutionsstudio.com>
 */

namespace Magespices\Bitcan\Cron;

use Magento\Framework\Exception\InputException;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Sales\Api\Data\OrderInterface;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\OrderFactory;
use Magento\Sales\Model\OrderRepository;
use Magento\Sales\Model\ResourceModel\Order as OrderResourceModel;
use Magento\Sales\Model\ResourceModel\Order\CollectionFactory as OrderCollectionFactory;
use Magespices\Bitcan\Helper\Data;
use Magespices\Bitcan\Model\Payment\Bitcan;
use Psr\Log\LoggerInterface;

/**
 * Class UpdatePayment
 * @package Magespices\Bitcan\Cron
 */
class UpdatePayment
{
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
     * @var LoggerInterface
     */
    protected $logger;

    /**
     * UpdatePayment constructor.
     * @param Data $helper
     * @param OrderCollectionFactory $orderCollectionFactory
     * @param OrderFactory $orderFactory
     * @param OrderResourceModel $orderResourceModel
     * @param OrderRepository $orderRepository
     * @param LoggerInterface $logger
     */
    public function __construct(
        Data $helper,
        OrderCollectionFactory $orderCollectionFactory,
        OrderFactory $orderFactory,
        OrderResourceModel $orderResourceModel,
        OrderRepository $orderRepository,
        LoggerInterface $logger
    ) {
        $this->helper = $helper;
        $this->_orderCollectionFactory = $orderCollectionFactory;
        $this->orderFactory = $orderFactory;
        $this->orderResourceModel = $orderResourceModel;
        $this->orderRepository = $orderRepository;
        $this->logger = $logger;
    }

    /**
     * @throws InputException
     * @throws NoSuchEntityException
     */
    public function execute(): void
    {
        $orders = $this->getOrders();
        foreach($orders as $order) {
            $this->helper->checkAndUpdateTransaction($order);
        }
    }

    /**
     * @return OrderInterface[]
     * @throws InputException
     * @throws NoSuchEntityException
     */
    protected function getOrders(): array
    {
        $orders = [];
        $ordersCollection = $this->_orderCollectionFactory->create();

        $ordersCollection->getSelect()
            ->join(
                ['sop' => $ordersCollection->getConnection()->getTableName('sales_order_payment')],
                'main_table.entity_id = sop.parent_id',
                ['method', 'additional_information']
            )
            ->where('sop.method = ?', Bitcan::PAYMENT_CODE );

        foreach($ordersCollection->getItems() as $order) {
            $orders[] = $this->orderRepository->get($order->getId());
        }

        return $orders;
    }
}