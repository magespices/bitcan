<?php
/**
 * Created by Q-Solutions Studio
 * Date: 02.09.2020
 *
 * @category    Magespices
 * @package     Magespices_Bitcan
 * @author      Maciej Buchert <maciej@qsolutionsstudio.com>
 */

namespace Magespices\Bitcan\Setup\Patch\Data;

use Magento\Framework\Setup\Patch\DataPatchInterface;
use Magespices\Bitcan\Helper\Data;

/**
 * Class UpdateExchangeRates
 * @package Magespices\Bitcan\Setup\Patch\Data
 */
class UpdateExchangeRates implements DataPatchInterface
{
    /**
     * @var Data
     */
    protected $helper;

    /**
     * UpdateExchangeRates constructor.
     * @param Data $helper
     */
    public function __construct(Data $helper)
    {
        $this->helper = $helper;
    }

    /**
     * @inheritDoc
     */
    public static function getDependencies(): array
    {
        return [];
    }

    /**
     * @inheritDoc
     */
    public function getAliases(): array
    {
        return [];
    }

    /**
     * @inheritDoc
     */
    public function apply(): self
    {
        $this->helper->updateExchangeRate();
        return $this;
    }
}