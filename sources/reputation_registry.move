module agent8004::reputation_registry;

use std::string::String;
use sui::event;
use sui::table::{Self, Table};

/// Simple feedback entry
public struct Feedback has copy, drop, store {
    score: u8,
    client: address,
    file_uri: String,
    file_hash: vector<u8>,
}

/// Shared reputation registry
public struct ReputationRegistry has key {
    id: UID,
    // agent_id -> list of feedbacks
    feedbacks: Table<u64, vector<Feedback>>,
}

/// Events
public struct NewFeedback has copy, drop {
    agent_id: u64,
    client_address: address,
    score: u8,
    file_uri: String,
    file_hash: vector<u8>,
}

/// Initialize the reputation registry
fun init(ctx: &mut TxContext) {
    let registry = ReputationRegistry {
        id: object::new(ctx),
        feedbacks: table::new(ctx),
    };
    transfer::share_object(registry);
}

/// Give feedback for an agent
public fun give_feedback(
    registry: &mut ReputationRegistry,
    agent_id: u64,
    score: u8,
    file_uri: String,
    file_hash: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(score <= 100, 0); // Score must be 0-100

    let client = tx_context::sender(ctx);

    // Initialize agent feedback list if needed
    if (!table::contains(&registry.feedbacks, agent_id)) {
        table::add(&mut registry.feedbacks, agent_id, vector::empty());
    };

    let feedbacks_list = table::borrow_mut(&mut registry.feedbacks, agent_id);

    let feedback = Feedback {
        score,
        client,
        file_uri,
        file_hash,
    };

    vector::push_back(feedbacks_list, feedback);

    event::emit(NewFeedback {
        agent_id,
        client_address: client,
        score,
        file_uri,
        file_hash,
    });
}

/// Get all feedback for an agent
public fun get_feedbacks(registry: &ReputationRegistry, agent_id: u64): vector<Feedback> {
    if (!table::contains(&registry.feedbacks, agent_id)) {
        return vector::empty()
    };

    *table::borrow(&registry.feedbacks, agent_id)
}

/// Get summary (count and average score for agent)
public fun get_summary(registry: &ReputationRegistry, agent_id: u64): (u64, u8) {
    if (!table::contains(&registry.feedbacks, agent_id)) {
        return (0, 0)
    };

    let feedbacks_list = table::borrow(&registry.feedbacks, agent_id);
    let count = vector::length(feedbacks_list);

    if (count == 0) {
        return (0, 0)
    };

    let mut total_score: u64 = 0;
    let mut i = 0;

    while (i < count) {
        let feedback = vector::borrow(feedbacks_list, i);
        total_score = total_score + (feedback.score as u64);
        i = i + 1;
    };

    let average = (total_score / count as u8);
    (count, average)
}
