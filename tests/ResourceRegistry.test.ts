import { describe, it, expect, beforeEach } from "vitest";
import { buffCV, stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_HASH = 101;
const ERR_INVALID_TITLE = 102;
const ERR_INVALID_DESCRIPTION = 103;
const ERR_INVALID_IPFS_LINK = 104;
const ERR_RESOURCE_ALREADY_EXISTS = 105;
const ERR_RESOURCE_NOT_FOUND = 106;
const ERR_INVALID_CATEGORY = 109;
const ERR_INVALID_FORMAT = 115;
const ERR_INVALID_LICENSE = 117;
const ERR_INVALID_MAX_VERSIONS = 118;
const ERR_INVALID_ACCESS_FEE = 120;
const ERR_MAX_RESOURCES_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_AUTHORITY_NOT_VERIFIED = 108;
const ERR_INVALID_VERSION = 119;

interface Resource {
  hash: Uint8Array;
  title: string;
  description: string;
  ipfsLink: string;
  owner: string;
  registeredAt: number;
  category: string;
  status: boolean;
  format: string;
  visibility: boolean;
  license: string;
  maxVersions: number;
  currentVersion: number;
  accessFee: number;
}

interface ResourceUpdate {
  updateTitle: string;
  updateDescription: string;
  updateIpfsLink: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ResourceRegistryMock {
  state: {
    nextResourceId: number;
    maxResources: number;
    registrationFee: number;
    authorityContract: string | null;
    resources: Map<number, Resource>;
    resourceUpdates: Map<number, ResourceUpdate>;
    resourcesByHash: Map<string, number>;
  } = {
    nextResourceId: 0,
    maxResources: 10000,
    registrationFee: 500,
    authorityContract: null,
    resources: new Map(),
    resourceUpdates: new Map(),
    resourcesByHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextResourceId: 0,
      maxResources: 10000,
      registrationFee: 500,
      authorityContract: null,
      resources: new Map(),
      resourceUpdates: new Map(),
      resourcesByHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  registerResource(
    hash: Uint8Array,
    title: string,
    description: string,
    ipfsLink: string,
    category: string,
    format: string,
    visibility: boolean,
    license: string,
    maxVersions: number,
    accessFee: number
  ): Result<number> {
    if (this.state.nextResourceId >= this.state.maxResources) return { ok: false, value: ERR_MAX_RESOURCES_EXCEEDED };
    if (hash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (!title || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!ipfsLink || ipfsLink.length > 200) return { ok: false, value: ERR_INVALID_IPFS_LINK };
    if (!["ebook", "article", "video", "audio"].includes(category)) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (!["PDF", "EPUB", "MP4", "MP3"].includes(format)) return { ok: false, value: ERR_INVALID_FORMAT };
    if (!["CC-BY", "CC-BY-SA", "Public Domain"].includes(license)) return { ok: false, value: ERR_INVALID_LICENSE };
    if (maxVersions <= 0 || maxVersions > 10) return { ok: false, value: ERR_INVALID_MAX_VERSIONS };
    if (accessFee > 10000) return { ok: false, value: ERR_INVALID_ACCESS_FEE };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const hashKey = hash.toString();
    if (this.state.resourcesByHash.has(hashKey)) return { ok: false, value: ERR_RESOURCE_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextResourceId;
    const resource: Resource = {
      hash,
      title,
      description,
      ipfsLink,
      owner: this.caller,
      registeredAt: this.blockHeight,
      category,
      status: true,
      format,
      visibility,
      license,
      maxVersions,
      currentVersion: 1,
      accessFee,
    };
    this.state.resources.set(id, resource);
    this.state.resourcesByHash.set(hashKey, id);
    this.state.nextResourceId++;
    return { ok: true, value: id };
  }

  getResource(id: number): Resource | null {
    return this.state.resources.get(id) || null;
  }

  updateResource(id: number, updateTitle: string, updateDescription: string, updateIpfsLink: string, newVersion: number): Result<boolean> {
    const resource = this.state.resources.get(id);
    if (!resource) return { ok: false, value: ERR_RESOURCE_NOT_FOUND };
    if (resource.owner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!updateTitle || updateTitle.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (updateDescription.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!updateIpfsLink || updateIpfsLink.length > 200) return { ok: false, value: ERR_INVALID_IPFS_LINK };
    if (newVersion <= 0 || newVersion > resource.maxVersions) return { ok: false, value: ERR_INVALID_VERSION };

    const updated: Resource = {
      ...resource,
      title: updateTitle,
      description: updateDescription,
      ipfsLink: updateIpfsLink,
      currentVersion: newVersion,
    };
    this.state.resources.set(id, updated);
    this.state.resourceUpdates.set(id, {
      updateTitle,
      updateDescription,
      updateIpfsLink,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getResourceCount(): Result<number> {
    return { ok: true, value: this.state.nextResourceId };
  }

  checkResourceExistence(hash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.resourcesByHash.has(hash.toString()) };
  }

  deactivateResource(id: number): Result<boolean> {
    const resource = this.state.resources.get(id);
    if (!resource) return { ok: false, value: ERR_RESOURCE_NOT_FOUND };
    if (resource.owner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const updated: Resource = { ...resource, status: false };
    this.state.resources.set(id, updated);
    return { ok: true, value: true };
  }

  changeOwner(id: number, newOwner: string): Result<boolean> {
    const resource = this.state.resources.get(id);
    if (!resource) return { ok: false, value: ERR_RESOURCE_NOT_FOUND };
    if (resource.owner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newOwner === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_NOT_AUTHORIZED };
    const updated: Resource = { ...resource, owner: newOwner };
    this.state.resources.set(id, updated);
    return { ok: true, value: true };
  }
}

describe("ResourceRegistry", () => {
  let contract: ResourceRegistryMock;

  beforeEach(() => {
    contract = new ResourceRegistryMock();
    contract.reset();
  });

  it("registers a resource successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    const result = contract.registerResource(
      hash,
      "Title1",
      "Desc1",
      "ipfs://link1",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const resource = contract.getResource(0);
    expect(resource?.title).toBe("Title1");
    expect(resource?.description).toBe("Desc1");
    expect(resource?.ipfsLink).toBe("ipfs://link1");
    expect(resource?.category).toBe("ebook");
    expect(resource?.format).toBe("PDF");
    expect(resource?.visibility).toBe(true);
    expect(resource?.license).toBe("CC-BY");
    expect(resource?.maxVersions).toBe(5);
    expect(resource?.currentVersion).toBe(1);
    expect(resource?.accessFee).toBe(100);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate resource hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.registerResource(
      hash,
      "Title1",
      "Desc1",
      "ipfs://link1",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    const result = contract.registerResource(
      hash,
      "Title2",
      "Desc2",
      "ipfs://link2",
      "article",
      "EPUB",
      false,
      "CC-BY-SA",
      3,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_RESOURCE_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const hash = new Uint8Array(32).fill(2);
    const result = contract.registerResource(
      hash,
      "Title",
      "Desc",
      "ipfs://link",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects registration without authority contract", () => {
    const hash = new Uint8Array(32).fill(3);
    const result = contract.registerResource(
      hash,
      "Title",
      "Desc",
      "ipfs://link",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid title", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(4);
    const result = contract.registerResource(
      hash,
      "",
      "Desc",
      "ipfs://link",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("rejects invalid category", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(5);
    const result = contract.registerResource(
      hash,
      "Title",
      "Desc",
      "ipfs://link",
      "invalid",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CATEGORY);
  });

  it("updates a resource successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(6);
    contract.registerResource(
      hash,
      "OldTitle",
      "OldDesc",
      "old://link",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    const result = contract.updateResource(0, "NewTitle", "NewDesc", "new://link", 2);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const resource = contract.getResource(0);
    expect(resource?.title).toBe("NewTitle");
    expect(resource?.description).toBe("NewDesc");
    expect(resource?.ipfsLink).toBe("new://link");
    expect(resource?.currentVersion).toBe(2);
    const update = contract.state.resourceUpdates.get(0);
    expect(update?.updateTitle).toBe("NewTitle");
    expect(update?.updateDescription).toBe("NewDesc");
    expect(update?.updateIpfsLink).toBe("new://link");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent resource", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateResource(99, "NewTitle", "NewDesc", "new://link", 2);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_RESOURCE_NOT_FOUND);
  });

  it("rejects update by non-owner", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(7);
    contract.registerResource(
      hash,
      "Title",
      "Desc",
      "ipfs://link",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateResource(0, "NewTitle", "NewDesc", "new://link", 2);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
    const hash = new Uint8Array(32).fill(8);
    contract.registerResource(
      hash,
      "Title",
      "Desc",
      "ipfs://link",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects registration fee change without authority contract", () => {
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct resource count", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash1 = new Uint8Array(32).fill(9);
    const hash2 = new Uint8Array(32).fill(10);
    contract.registerResource(
      hash1,
      "Title1",
      "Desc1",
      "ipfs://link1",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    contract.registerResource(
      hash2,
      "Title2",
      "Desc2",
      "ipfs://link2",
      "article",
      "EPUB",
      false,
      "CC-BY-SA",
      3,
      200
    );
    const result = contract.getResourceCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks resource existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(11);
    contract.registerResource(
      hash,
      "Title",
      "Desc",
      "ipfs://link",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    const result = contract.checkResourceExistence(hash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(12);
    const result2 = contract.checkResourceExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("deactivates resource successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(13);
    contract.registerResource(
      hash,
      "Title",
      "Desc",
      "ipfs://link",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    const result = contract.deactivateResource(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const resource = contract.getResource(0);
    expect(resource?.status).toBe(false);
  });

  it("changes owner successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(14);
    contract.registerResource(
      hash,
      "Title",
      "Desc",
      "ipfs://link",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    const result = contract.changeOwner(0, "ST4NEW");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const resource = contract.getResource(0);
    expect(resource?.owner).toBe("ST4NEW");
  });

  it("rejects registration with max resources exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxResources = 1;
    const hash1 = new Uint8Array(32).fill(16);
    contract.registerResource(
      hash1,
      "Title1",
      "Desc1",
      "ipfs://link1",
      "ebook",
      "PDF",
      true,
      "CC-BY",
      5,
      100
    );
    const hash2 = new Uint8Array(32).fill(17);
    const result = contract.registerResource(
      hash2,
      "Title2",
      "Desc2",
      "ipfs://link2",
      "article",
      "EPUB",
      false,
      "CC-BY-SA",
      3,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_RESOURCES_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});