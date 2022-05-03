import { expect } from "chai";
import { ethers, deployments, network, getChainId } from "hardhat";
import { TheUbiquityStick } from "types/TheUbiquityStick";
import tokenURIs from "metadata/jsonTests.json";
import { SignerWithAddress } from "hardhat-deploy-ethers/signers";

describe("TheUbiquityStick", () => {
  let theUbiquityStick: TheUbiquityStick;
  let tokenIdStart: number;

  let minter: SignerWithAddress;
  let tester1: SignerWithAddress;
  let tester2: SignerWithAddress;
  let random: SignerWithAddress;

  before(async () => {
    const chainId = Number(await getChainId());
    console.log("network", chainId, network.name, network.live);

    ({ minter, tester1, tester2, random } = await ethers.getNamedSigners());
    // DEPLOY NFTPass contract if not already
    if (!(await deployments.getOrNull("TheUbiquityStick"))) {
      console.log("Deploy TheUbiquityStick...");
      await deployments.fixture(["TheUbiquityStick"]);
    }

    // GET NFTPass contract
    theUbiquityStick = await ethers.getContract("TheUbiquityStick", minter);
    console.log("contract", theUbiquityStick.address);

    tokenIdStart = Number(await theUbiquityStick.tokenIdNext());
    console.log("tokenIdStart", tokenIdStart);

    const owner = await theUbiquityStick.owner();
    console.log("owner", owner);
  });

  it("Check Contract Addresses", async () => {
    expect(theUbiquityStick.address).to.be.properAddress;
    expect(await theUbiquityStick.owner()).to.be.properAddress;
  });

  it("Check Contract is ERC721, ERC721Metadata, ERC721Enumerable and not ERC721TokenReceiver", async () => {
    const ERC721 = "0x80ac58cd";
    const ERC721TokenReceiver = "0x150b7a02";
    const ERC721Metadata = "0x5b5e139f";
    const ERC721Enumerable = "0x780e9d63";

    expect(await theUbiquityStick.supportsInterface(ERC721)).to.be.true;
    expect(await theUbiquityStick.supportsInterface(ERC721Metadata)).to.be.true;
    expect(await theUbiquityStick.supportsInterface(ERC721Enumerable)).to.be.true;
    expect(await theUbiquityStick.supportsInterface(ERC721TokenReceiver)).to.be.false;
  });

  it("Check Minting for minter", async () => {
    // 2 NFTs for tester 1 and 1 NFT for tester2
    await expect((await theUbiquityStick.connect(minter).safeMint(tester1.address)).wait()).to.be.not.reverted;
    await expect((await theUbiquityStick.connect(minter).safeMint(tester2.address)).wait()).to.be.not.reverted;
    await expect((await theUbiquityStick.connect(minter).safeMint(tester1.address)).wait()).to.be.not.reverted;
  });

  it("Check Minting Forbidden for non-minter", async () => {
    await expect(theUbiquityStick.connect(tester1).safeMint(tester1.address)).to.be.reverted;
  });

  it("Check setMinter", async () => {
    await expect(theUbiquityStick.connect(tester1).safeMint(tester1.address)).to.be.reverted;
    await expect((await theUbiquityStick.connect(minter).setMinter(tester1.address)).wait()).to.be.not.reverted;
    await expect((await theUbiquityStick.connect(tester1).safeMint(tester1.address)).wait()).to.be.not.reverted;
    await expect(theUbiquityStick.connect(minter).safeMint(tester1.address)).to.be.reverted;
    await expect((await theUbiquityStick.connect(minter).setMinter(minter.address)).wait()).to.be.not.reverted;
  });

  it("Check balanceOf", async () => {
    expect(await theUbiquityStick.balanceOf(tester1.address)).to.be.gte(2);
    expect(await theUbiquityStick.balanceOf(tester2.address)).to.be.gte(1);
    expect(await theUbiquityStick.balanceOf(random.address)).to.be.equal(0);
  });

  it("Check ownerOf", async () => {
    expect(await theUbiquityStick.ownerOf(tokenIdStart)).to.be.equal(tester1.address);
    expect(await theUbiquityStick.ownerOf(tokenIdStart + 1)).to.be.equal(tester2.address);
    expect(await theUbiquityStick.ownerOf(tokenIdStart + 2)).to.be.equal(tester1.address);
    await expect(theUbiquityStick.ownerOf(0)).to.be.revertedWith("ERC721: owner query for nonexistent token");
    await expect(theUbiquityStick.ownerOf(1)).to.be.not.reverted;
    await expect(theUbiquityStick.ownerOf(999)).to.be.revertedWith("ERC721: owner query for nonexistent token");
  });

  it("Check burn", async () => {
    await expect((await theUbiquityStick.connect(tester1).burn(tokenIdStart + 2)).wait()).to.be.not.reverted;
    await expect(theUbiquityStick.connect(tester1).burn(tokenIdStart + 2)).to.be.revertedWith(
      "ERC721: operator query for nonexistent token"
    );
    await expect(theUbiquityStick.connect(tester1).burn(tokenIdStart + 1)).to.be.revertedWith(
      "ERC721Burnable: caller is not owner nor approved"
    );
    await expect(theUbiquityStick.connect(minter).burn(999)).to.be.revertedWith(
      "ERC721: operator query for nonexistent token"
    );
  });

  it("Check setTokenURI", async () => {
    await expect((await theUbiquityStick.connect(minter).setTokenURI(0, tokenURIs.standardJson)).wait()).to.be.not
      .reverted;
    await expect((await theUbiquityStick.connect(minter).setTokenURI(1, tokenURIs.goldJson)).wait()).to.be.not.reverted;
    await expect((await theUbiquityStick.connect(minter).setTokenURI(2, tokenURIs.invisibleJson)).wait()).to.be.not
      .reverted;
    expect(await theUbiquityStick.tokenURI(tokenIdStart + 1)).to.be.oneOf([
      tokenURIs.standardJson,
      tokenURIs.goldJson,
      tokenURIs.invisibleJson
    ]);
    await expect(theUbiquityStick.connect(tester1).setTokenURI(0, tokenURIs.standardJson)).to.be.reverted;
    await expect(theUbiquityStick.connect(tester1).setTokenURI(1, tokenURIs.standardJson)).to.be.reverted;
  });

  it("Mint lot of NFTs", async () => {
    let nn = network.name === "hardhat" ? 1024 : network.name === "rinkeby" ? 16 : network.name === "matic" ? 1 : 0;

    if (nn) {
      const tokenIdMin = Number(await theUbiquityStick.tokenIdNext());
      for (let i = tokenIdMin; i < tokenIdMin + nn; i++) {
        await (await theUbiquityStick.connect(minter).safeMint(tester1.address)).wait();
      }
      expect(await theUbiquityStick.balanceOf(tester1.address)).to.be.gte(nn);

      const tokenIdMax = Number(await theUbiquityStick.tokenIdNext());
      expect(tokenIdMax).to.be.equal(tokenIdMin + nn);
      console.log("nTotal", nn);
    }
  });

  it("Check gold pourcentage about 1.5%", async () => {
    let nGold = 0;
    let goldies = "";

    const tokenIdMax = Number(await theUbiquityStick.tokenIdNext());
    console.log("tokenIdMax", tokenIdMax);

    for (let i = 0; i < tokenIdMax; i++)
      if (await theUbiquityStick.gold(i)) {
        goldies += ` ${i}`;
        nGold++;
      }
    console.log("nGold", nGold, goldies);

    const ratio = (100 * nGold) / tokenIdMax;
    console.log("ratio ", ratio, "%");

    // if nn big enough expect ratio around theoritical 1,5
    if (tokenIdMax > 300) expect(ratio).to.be.gt(1).and.to.be.lt(3);
  });

  describe("Mutable NFT", () => {
    let tokenIdMutable: number;
    before(async () => {
      tokenIdMutable = Number(await theUbiquityStick.tokenIdNext());
      console.log("tokenIdMutable", tokenIdMutable);

      await (await theUbiquityStick.connect(minter).safeMint(tester1.address)).wait();
    });

    it("Check tokenURI mutation", async () => {
      const tokenURI0 = await theUbiquityStick.tokenURI(tokenIdMutable);
      await theUbiquityStick.connect(tester1).setTokenMutableURI(tokenIdMutable, tokenURIs.mutableJson);
      const tokenURI1 = await theUbiquityStick.tokenURI(tokenIdMutable);

      expect(tokenURI1).to.be.not.equal(tokenURI0);
      expect(tokenURI1).to.be.equal(tokenURIs.mutableJson);
    });

    it("Check can't change tokenURI if not NFT owner", async () => {
      await expect(
        theUbiquityStick.connect(minter).setTokenMutableURI(tokenIdMutable, tokenURIs.mutableJson)
      ).to.be.revertedWith("Not NFT owner");
    });
  });

  describe("NFT Royalties", () => {});
});
