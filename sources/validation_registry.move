module agent8004::validation_registry;

use agent8004::identity_registry::{Self, Agent};
use std::string::{Self, String};
use sui::event;
use sui::table::{Self, Table};

public struct ValidationRegistry has key {
    id: UID,
    // request_hash -> ValidationRequest
    requests: Table<vector<u8>, ValidationRequest>,
}

public struct ValidationRequest has store {
    validator: address,
    agent_id: u64,
    request_uri: String,
    responses: vector<ValidationResponse>,
}

public struct ValidationResponse has copy, drop, store {
    response: u8,
    response_uri: String,
    response_hash: vector<u8>,
    tag: vector<u8>,
}

public struct ValidationRequestEvent has copy, drop {
    validator: address,
    agent_id: u64,
    request_hash: vector<u8>,
}

public struct ValidationResponseEvent has copy, drop {
    validator: address,
    agent_id: u64,
    request_hash: vector<u8>,
    response: u8,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(ValidationRegistry {
        id: object::new(ctx),
        requests: table::new(ctx),
    });
}

public fun validation_request(
    registry: &mut ValidationRegistry,
    agent: &Agent,
    validator: address,
    request_uri: vector<u8>,
    request_hash: vector<u8>,
    _ctx: &mut TxContext,
) {
    let agent_id = identity_registry::get_agent_id(agent);

    let request = ValidationRequest {
        validator,
        agent_id,
        request_uri: string::utf8(request_uri),
        responses: vector::empty(),
    };

    table::add(&mut registry.requests, request_hash, request);

    event::emit(ValidationRequestEvent {
        validator,
        agent_id,
        request_hash,
    });
}

public fun validation_response(
    registry: &mut ValidationRegistry,
    request_hash: vector<u8>,
    response: u8,
    response_uri: vector<u8>,
    response_hash: vector<u8>,
    tag: vector<u8>,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);
    let request = table::borrow_mut(&mut registry.requests, request_hash);

    assert!(request.validator == sender, 0);

    let validation_resp = ValidationResponse {
        response,
        response_uri: string::utf8(response_uri),
        response_hash,
        tag,
    };
    vector::push_back(&mut request.responses, validation_resp);

    event::emit(ValidationResponseEvent {
        validator: sender,
        agent_id: request.agent_id,
        request_hash,
        response,
    });
}
