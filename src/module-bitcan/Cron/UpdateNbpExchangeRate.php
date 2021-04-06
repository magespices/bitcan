<?php
/**
 * Created by Q-Solutions Studio
 * Date: 02.09.2020
 *
 * @category    Magespices
 * @package     Magespices_Bitcan
 * @author      Maciej Buchert <maciej@qsolutionsstudio.com>
 */

namespace Magespices\Bitcan\Cron;

use Magespices\Bitcan\Helper\Data;

/**
 * Class GetNbpExchangeRate
 * @package Magespices\Bitcan\Cron
 */
class UpdateNbpExchangeRate
{
    /**
     * @var Data
     */
    protected $helper;

    /**
     * UpdateNbpExchangeRate constructor.
     * @param Data $helper
     */
    public function __construct(Data $helper)
    {
        $this->helper = $helper;
    }

    public function execute(): void
    {
        $this->helper->updateExchangeRate();
    }
}