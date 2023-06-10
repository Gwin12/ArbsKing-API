const { Contract, Wallet, providers} = require("ethers");
const { testnet, mainnet } = require("./config.json");

const { usdt, busd, rpc } = testnet
// const { usdt, busd } = mainnet
const connection = new providers.JsonRpcProvider(rpc);
let wallet = Wallet.createRandom().connect(connection);

const usdtContract = new Contract(usdt.address, usdt.abi, wallet)

const busdContract = new Contract(busd.address, busd.abi, wallet)

module.exports = {
    connection,
    usdtContract,
    busdContract
}