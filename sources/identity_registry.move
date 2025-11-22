module agent8004::identity_registry;

use std::string::{Self, String};
use sui::event;
use sui::table::{Self, Table};

public struct IdentityRegistry has key {
    id: UID,
    agent_count: u64,
    agents: Table<u64, ID>,
}

public struct Agent has key, store {
    id: UID,
    agent_id: u64,
    name: String,
    description: String,
    image: String,
    token_uri: String,
    endpoints: vector<Endpoint>,
}

public struct Endpoint has copy, drop, store {
    name: String,
    endpoint: String,
    version: String,
}

// Events
public struct AgentRegistered has copy, drop {
    agent_id: u64,
    owner: address,
}

fun init(ctx: &mut TxContext) {
    let registry = IdentityRegistry {
        id: object::new(ctx),
        agent_count: 0,
        agents: table::new(ctx),
    };
    transfer::share_object(registry);
}

public fun register(
    registry: &mut IdentityRegistry,
    name: vector<u8>,
    description: vector<u8>,
    image: vector<u8>,
    token_uri: vector<u8>,
    ctx: &mut TxContext,
): Agent {
    let sender = tx_context::sender(ctx);
    let agent_id = registry.agent_count + 1;
    registry.agent_count = agent_id;

    let agent = Agent {
        id: object::new(ctx),
        agent_id,
        name: string::utf8(name),
        description: string::utf8(description),
        image: string::utf8(image),
        token_uri: string::utf8(token_uri),
        endpoints: vector::empty(),
    };

    table::add(&mut registry.agents, agent_id, object::id(&agent));

    event::emit(AgentRegistered {
        agent_id,
        owner: sender,
    });

    agent
}

// Add endpoint to an existing agent
public fun add_endpoint(
    agent: &mut Agent,
    name: vector<u8>,
    endpoint: vector<u8>,
    version: vector<u8>,
) {
    let endpoint_data = Endpoint {
        name: string::utf8(name),
        endpoint: string::utf8(endpoint),
        version: string::utf8(version),
    };
    vector::push_back(&mut agent.endpoints, endpoint_data);
}

public fun set_token_uri(agent: &mut Agent, token_uri: String) {
    agent.token_uri = token_uri;
}

public fun set_description(agent: &mut Agent, description: String) {
    agent.description = description;
}

public fun set_image(agent: &mut Agent, image: String) {
    agent.image = image;
}

public fun get_agent_id(agent: &Agent): u64 {
    agent.agent_id
}

public fun agent_exists(registry: &IdentityRegistry, agent_id: u64): bool {
    table::contains(&registry.agents, agent_id)
}

// Getter functions for Agent fields
public fun get_agent_name(agent: &Agent): String {
    agent.name
}

public fun get_agent_description(agent: &Agent): String {
    agent.description
}

public fun get_agent_image(agent: &Agent): String {
    agent.image
}

public fun get_agent_token_uri(agent: &Agent): String {
    agent.token_uri
}

public fun get_agent_endpoints(agent: &Agent): vector<Endpoint> {
    agent.endpoints
}

// Get specific endpoint fields at index
public fun get_agent_endpoint_at(agent: &Agent, index: u64): (String, String, String) {
    let endpoint = vector::borrow(&agent.endpoints, index);
    (endpoint.name, endpoint.endpoint, endpoint.version)
}
