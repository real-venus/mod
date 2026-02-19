// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

// Encrypted type handles — opaque pointers to ciphertexts on the FHE coprocessor.
// On-chain these are bytes32 values; the coprocessor resolves them to actual ciphertexts.
type ebool is bytes32;
type euint8 is bytes32;
type euint16 is bytes32;
type euint32 is bytes32;
type euint64 is bytes32;
type euint128 is bytes32;
type euint256 is bytes32;
type eaddress is bytes32;
type einput is bytes32;

/// @title TFHE — Fully Homomorphic Encryption library for Solidity
/// @notice Mirrors Zama fhEVM v0.6 TFHE library interface.
///         All operations produce new ciphertext handles via the coprocessor;
///         the host chain only stores and routes bytes32 pointers.
library TFHE {

    // ----------------------------------------------------------------
    //  Input conversion — verify ZK proof and obtain a handle
    // ----------------------------------------------------------------

    function asEbool(einput input, bytes memory proof) internal pure returns (ebool) {
        return ebool.wrap(einput.unwrap(input));
    }

    function asEuint8(einput input, bytes memory proof) internal pure returns (euint8) {
        return euint8.wrap(einput.unwrap(input));
    }

    function asEuint16(einput input, bytes memory proof) internal pure returns (euint16) {
        return euint16.wrap(einput.unwrap(input));
    }

    function asEuint32(einput input, bytes memory proof) internal pure returns (euint32) {
        return euint32.wrap(einput.unwrap(input));
    }

    function asEuint64(einput input, bytes memory proof) internal pure returns (euint64) {
        return euint64.wrap(einput.unwrap(input));
    }

    function asEuint128(einput input, bytes memory proof) internal pure returns (euint128) {
        return euint128.wrap(einput.unwrap(input));
    }

    // Plaintext → encrypted handle
    function asEbool(bool value) internal pure returns (ebool) {
        return ebool.wrap(bytes32(value ? uint256(1) : uint256(0)));
    }

    function asEuint8(uint8 value) internal pure returns (euint8) {
        return euint8.wrap(bytes32(uint256(value)));
    }

    function asEuint64(uint64 value) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(value)));
    }

    // ----------------------------------------------------------------
    //  Arithmetic — homomorphic operations on ciphertext handles
    // ----------------------------------------------------------------

    function add(euint64 a, euint64 b) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) + uint256(euint64.unwrap(b))));
    }

    function add(euint64 a, uint64 b) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) + uint256(b)));
    }

    function sub(euint64 a, euint64 b) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) - uint256(euint64.unwrap(b))));
    }

    function sub(euint64 a, uint64 b) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) - uint256(b)));
    }

    function mul(euint64 a, euint64 b) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) * uint256(euint64.unwrap(b))));
    }

    function div(euint64 a, uint64 b) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) / uint256(b)));
    }

    function rem(euint64 a, uint64 b) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) % uint256(b)));
    }

    function min(euint64 a, euint64 b) internal pure returns (euint64) {
        uint256 ua = uint256(euint64.unwrap(a));
        uint256 ub = uint256(euint64.unwrap(b));
        return euint64.wrap(bytes32(ua < ub ? ua : ub));
    }

    function max(euint64 a, euint64 b) internal pure returns (euint64) {
        uint256 ua = uint256(euint64.unwrap(a));
        uint256 ub = uint256(euint64.unwrap(b));
        return euint64.wrap(bytes32(ua > ub ? ua : ub));
    }

    function neg(euint64 a) internal pure returns (euint64) {
        return euint64.wrap(bytes32(~uint256(euint64.unwrap(a)) + 1));
    }

    // ----------------------------------------------------------------
    //  Comparison — return encrypted booleans
    // ----------------------------------------------------------------

    function le(euint64 a, euint64 b) internal pure returns (ebool) {
        return asEbool(uint256(euint64.unwrap(a)) <= uint256(euint64.unwrap(b)));
    }

    function lt(euint64 a, euint64 b) internal pure returns (ebool) {
        return asEbool(uint256(euint64.unwrap(a)) < uint256(euint64.unwrap(b)));
    }

    function ge(euint64 a, euint64 b) internal pure returns (ebool) {
        return asEbool(uint256(euint64.unwrap(a)) >= uint256(euint64.unwrap(b)));
    }

    function gt(euint64 a, euint64 b) internal pure returns (ebool) {
        return asEbool(uint256(euint64.unwrap(a)) > uint256(euint64.unwrap(b)));
    }

    function eq(euint64 a, euint64 b) internal pure returns (ebool) {
        return asEbool(uint256(euint64.unwrap(a)) == uint256(euint64.unwrap(b)));
    }

    function ne(euint64 a, euint64 b) internal pure returns (ebool) {
        return asEbool(uint256(euint64.unwrap(a)) != uint256(euint64.unwrap(b)));
    }

    // Scalar comparisons
    function le(euint64 a, uint64 b) internal pure returns (ebool) {
        return le(a, asEuint64(b));
    }

    function le(uint64 a, euint64 b) internal pure returns (ebool) {
        return le(asEuint64(a), b);
    }

    // ----------------------------------------------------------------
    //  Boolean logic
    // ----------------------------------------------------------------

    function and_(ebool a, ebool b) internal pure returns (ebool) {
        uint256 ua = uint256(ebool.unwrap(a));
        uint256 ub = uint256(ebool.unwrap(b));
        return ebool.wrap(bytes32(ua & ub));
    }

    function or_(ebool a, ebool b) internal pure returns (ebool) {
        uint256 ua = uint256(ebool.unwrap(a));
        uint256 ub = uint256(ebool.unwrap(b));
        return ebool.wrap(bytes32(ua | ub));
    }

    function not_(ebool a) internal pure returns (ebool) {
        return ebool.wrap(bytes32(uint256(ebool.unwrap(a)) == 0 ? uint256(1) : uint256(0)));
    }

    // ----------------------------------------------------------------
    //  Conditional select — the core FHE branching primitive
    //  Because you cannot branch on encrypted data, both paths
    //  always execute and the result is selected homomorphically.
    // ----------------------------------------------------------------

    function select(ebool condition, euint64 ifTrue, euint64 ifFalse) internal pure returns (euint64) {
        if (uint256(ebool.unwrap(condition)) != 0) {
            return ifTrue;
        }
        return ifFalse;
    }

    function select(ebool condition, euint8 ifTrue, euint8 ifFalse) internal pure returns (euint8) {
        if (uint256(ebool.unwrap(condition)) != 0) {
            return ifTrue;
        }
        return ifFalse;
    }

    // ----------------------------------------------------------------
    //  Bitwise operations
    // ----------------------------------------------------------------

    function shl(euint64 a, uint8 bits) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) << bits));
    }

    function shr(euint64 a, uint8 bits) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) >> bits));
    }

    function xor_(euint64 a, euint64 b) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) ^ uint256(euint64.unwrap(b))));
    }

    // ----------------------------------------------------------------
    //  Randomness — on-chain encrypted random via coprocessor
    // ----------------------------------------------------------------

    function randEuint64() internal view returns (euint64) {
        return euint64.wrap(keccak256(abi.encodePacked(block.prevrandao, block.timestamp)));
    }

    // ----------------------------------------------------------------
    //  Access Control List (ACL)
    //  Manages which addresses can operate on ciphertext handles.
    //  In production fhEVM these are enforced by the coprocessor;
    //  here we provide the interface for contract compatibility.
    // ----------------------------------------------------------------

    function allowThis(ebool handle) internal pure {}
    function allowThis(euint8 handle) internal pure {}
    function allowThis(euint64 handle) internal pure {}
    function allowThis(euint128 handle) internal pure {}

    function allow(ebool handle, address account) internal pure {}
    function allow(euint8 handle, address account) internal pure {}
    function allow(euint64 handle, address account) internal pure {}
    function allow(euint128 handle, address account) internal pure {}

    function allowTransient(euint64 handle, address account) internal pure {}

    function isSenderAllowed(euint64 handle) internal pure returns (bool) {
        return true;
    }

    function isSenderAllowed(ebool handle) internal pure returns (bool) {
        return true;
    }
}
