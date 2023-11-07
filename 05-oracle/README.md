# 预言机
GMX 官方文档上描述它价格数据来源于两部分  
- 一个是 Chainlink Oracles
- 另一个是 聚合的中心化交易所价格   

<img src=./pictures/gmxOracleDescription.png width=50% />

[gmx price source description](https://gmx-docs.io/docs/intro)


## 预言机合约
查看 GMX 合约仓库，可以看到 GMX 主要使用两个合约获取这两个数据源的价格数据

- FastPriceFeed:  对应于 "聚合的中心化交易所价格"
- PriceFeed:  对应于 chainlink 数据源

[gmx oracle contracts](https://github.com/gmx-io/gmx-contracts/tree/master/contracts/oracle)   
[gmx contracts addresses](https://gmxio.gitbook.io/gmx/contracts)

链上部署的 PriceFeed 和仓库中的 PriceFeed 合约会有点不一样，下面将详细进行讲解

### PriceFeed 合约
查看 Arbitrum 上的 PriceFeed，可以看到该合约继承了 “AggregatorV2V3Interface” 接口。此处的合约名字不为 PriceFeed ，不过功能上和 PriceFeed 没差别    

<img src=./pictures/AggregatorProxy.png width=50% />

[arbitrum pricefeed address](https://arbiscan.io/address/0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3#code)


“AggregatorV2V3Interface” 是一个标准的 Data Feeds 接口，用于读取 Chainlink 链上价格数据，其中 lastestRoundData 用于获取最新的价格，GMX VaultPriceFeed 合约就是调用的这个接口获取 Chainlink 的链上价格数据。    

<img src=./pictures/DataConsumerV3.png width=30% />

Chainlink 链上价格数据的说明可参考如下官方文档   
[chainlink data feed](https://docs.chain.link/data-feeds/using-data-feeds)  

### FastPriceFeed 合约
"聚合的中心化交易所价格" 需要额外链下服务程序的实现，目前 GMX 没有开源这部分代码。   
查看 Arbitrum 上 FastPriceFeed 合约的交易，可以发现该合约被调用的主要就两个接口 “setPricesWithBitsAndExecute” 和 “setPricesWithBits”，其中
- setPricesWithBitsAndExecute ： 设置聚合价格的同时执行订单，这里的交易可以是 swap、open position、close position
- setPricesWithBits :  单纯的设置价格，不执行订单  

<img src=./pictures/FastPriceFeed.png width=50% />
<img src=./pictures/FastPriceFeedTransactions.png width=50% />    

[carbitrum pricefeed address](https://arbiscan.io/address/0x11d62807dae812a0f1571243460bf94325f43bb7)     
[gmx fastpricefeed contract](https://github.com/gmx-io/gmx-contracts/blob/master/contracts/oracle/FastPriceFeed.sol)    

"聚合的中心化交易所价格" 的通用实现为：   
1) 指定几个大中心化交易所，比如 Binance, OKX, Kucoin      
2) 指定每个交易所的权重，比如 Binance: 50%, OKX: 30%, Kucoin: 20%      
3)  调用各个交易所的 API ，获取指定 token 的 price。以 okx  为例，调用 mark-price 接口，获取 BTC-USDT 的兑换价格     

```shell
Request Example: GET /api/v5/public/mark-price?instType=SWAP
Response Example: {
    "code":"0",
    "msg":"",
    "data":[
    {
        "instType":"SWAP",
        "instId":"BTC-USDT-SWAP",
        "markPx":"200",
        "ts":"1597026383085"
    }
  ]
}
``` 

[okx api doc](https://www.okx.com/docs-v5/en/#public-data-rest-api-get-mark-price)  

4) 聚合各个交易所的价格作为发送到链上的最终价格，比如获取的 BTC 价格如下：   
Binance:  200   
OKX: 450   
Kucion: 300   

最终聚合价格 = 200 * 50%  + 450 * 30% + 300 * 20% = 295
当然，如果出现异常情况，比如调用 Biance 的 API 失败，无法获取价格时，可以使用备选的 cex 作为数据源；或是调整剩下几个 cex 的权重比，比如 OKX 权重调整为 60%, Kucoin 权重调整为 40%

一般在获取聚合价格后，不会直接上链，还会进行一定的处理，比如当前的聚合价格对比上一次的聚合价格有多大的波动，如果波动超过 40%，可以不上链此次的聚合价格等。而且在 FastPriceFeed 合约内部，也会对新传入的价格做相应的处理，具体可以查看 FastPriceFeed 合约实现   
https://github.com/gmx-io/gmx-contracts/blob/master/contracts/oracle/FastPriceFeed.sol   


# 价格机制 
上述我们讲解了 gmx 使用的 oracle 数据的来源，下面讲解下 gmx 如何使用这两个价格数据。   
需要说明的是，gmx 合约内部使用价格数据的时候，都是把 chainlink 价格和 **“**聚合的中心化交易所价格” 再次聚合，作为最终的价格，形如 （ 为叙述方便，后续 gmx 合约使用的最终价格称为 final price )  

```
final price = mix(chainLink price, “聚合的中心化交易所价格”)
```

## Final Price 使用场景 
final price 使用到的场景如下：   
- 提供流动性，对应于 Vault 合约中的 buyUSDG    
<img src=./pictures/buyUSDG.png width=50% />    

- 移除流动性，对应于 Vault 合约中的 sellUSDG    
<img src=./pictures/sellUSDG.png width=50% />  
<img src=./pictures/getRedemptionAmount.png width=50% />  

- swap  
<img src=./pictures/swap.png width=50% />      

- 开仓，对应 Vault 合约中的 increasePosition   
<img src=./pictures/increasePosition.png width=50% />   

- 平仓/减仓，对应 Vault 合约中的 decreasePosition   
<img src=./pictures/decreasePosition.png width=50% />   

- 清算，对应 Vault 合约中的 liquidatePosition  
<img src=./pictures/liquidatePosition.png width=50% />   



## getMinPrice/getMaxPrice
从 buyUSDG、sellUSDG、swap、increasePosition、decreasePosition 接口中可以看到，主要就是调用 getMaxPrice 和 getMinPrice 这两个接口获取 final price。  
<img src=./pictures/getPrice.png width=50% />    
查看 getMaxPrice 和 getMinPrice  的具体实现，可以发现他们之间的差别在于调用 IVaultPriceFeed(priceFeed).getPrice 传入的第二个参数为 true 或 false 的区别，这会导致返回的 final price 的不同  
- buyUSDG
在这个接口里面，调用的是 getMinPrice，这样用户的 input token 换算成 USDG 就会最小化，防止出现 "chainLink price" 或 "聚合的中心化交易所价格" 出现较大价格波动时，造成用户套利的情况
- sellUSDG
同理，在这个接口里面，调用的是 getMaxPrice，这样用户的 USDG 换算成 output token 时就会最小化，防止出现 "chainLink price" 或 "聚合的中心化交易所价格" 出现较大价格波动时，造成用户套利的情况  
- swap 
对于 input token 调用 getMinPrice， 对于 output toke 调用的是 getMaxPrice，最小化用户可以获取的 output token amount
- increasePosition
同 buyUSDG  
- decreasePosition
同 sellUSDG 
- liquidatePosition
同 buyUSDG 和 sellUSDG  

## final price 的具体实现
final price 的整体流程如下  
<img src=./pictures/finalPriceFlow.png width=50% />   
现在我们继续看下 IVaultPriceFeed(priceFeed).getPrice 中的 final price 是如何返回的   
<img src=./pictures/ChoosePricing.png width=50% />  

查看 getPrice 接口的实现，可知其内部的主体是 getPriceV2 和  getPriceV1。当前 gmx v1 版本中，useV2Pricing 为 false, 所以 getPrice 中调用的主体是 getPriceV1     
<img src=./pictures/VaultPriceFeed.png width=50% />   

### getPriceV1 实现  
在 getPriceV1 的实现中，主要调用如下三个接口获取价格   
- getPrimaryPrice:  Chainlink oracle 的价格，实际就是调用 priceFeed.latestAnswer 接口获取最新的价格数据 （ 因为目前 priceSampleSpace 设置为 1，所以只会走 i == 0 的分支 ） 
 <img src=./pictures/getPrimaryPrice.png width=50% /> 
- getAmmPrice： 获取 Pancake 交易所的价格。目前在 EVM compatible 的链，如 Arbitrum 的链，isAmmEnabled 参数为 false, 所以直接忽略 ammPrice   
- getSecondaryPrice： 这个就是 **“**聚合的中心化交易所价格”，其中 secondaryPriceFeed 就是 FastPriceFeed 合约的地址   
<img src=./pictures/getSecondaryPrice.png width=50% />    
[FastPriceFeed address](https://arbiscan.io/address/0x11d62807dae812a0f1571243460bf94325f43bb7#code)      

继续查看 FastPriceFeed 的 getPrice 实现   
```
function getPrice(address _token, uint256 _refPrice, bool _maximise) external override view returns (uint256) {
        if (block.timestamp > lastUpdatedAt.add(maxPriceUpdateDelay)) {
            if (_maximise) {
                return _refPrice.mul(BASIS_POINTS_DIVISOR.add(spreadBasisPointsIfChainError)).div(BASIS_POINTS_DIVISOR);
            }

            return _refPrice.mul(BASIS_POINTS_DIVISOR.sub(spreadBasisPointsIfChainError)).div(BASIS_POINTS_DIVISOR);
        }

        if (block.timestamp > lastUpdatedAt.add(priceDuration)) {
            if (_maximise) {
                return _refPrice.mul(BASIS_POINTS_DIVISOR.add(spreadBasisPointsIfInactive)).div(BASIS_POINTS_DIVISOR);
            }

            return _refPrice.mul(BASIS_POINTS_DIVISOR.sub(spreadBasisPointsIfInactive)).div(BASIS_POINTS_DIVISOR);
        }

        uint256 fastPrice = prices[_token];
        if (fastPrice == 0) { return _refPrice; }

        uint256 diffBasisPoints = _refPrice > fastPrice ? _refPrice.sub(fastPrice) : fastPrice.sub(_refPrice);
        diffBasisPoints = diffBasisPoints.mul(BASIS_POINTS_DIVISOR).div(_refPrice);

        // create a spread between the _refPrice and the fastPrice if the maxDeviationBasisPoints is exceeded
        // or if watchers have flagged an issue with the fast price
        bool hasSpread = !favorFastPrice(_token) || diffBasisPoints > maxDeviationBasisPoints;

        if (hasSpread) {
            // return the higher of the two prices
            if (_maximise) {
                return _refPrice > fastPrice ? _refPrice : fastPrice;
            }

            // return the lower of the two prices
            return _refPrice < fastPrice ? _refPrice : fastPrice;
        }

        return fastPrice;
    }

```