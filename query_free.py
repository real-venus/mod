#!/usr/bin/env python3
"""
Query utility using free OpenRouter models or Venice AI.

Usage:
    python query_free.py "your question here"
    python query_free.py "your question" --venice
    python query_free.py "your question" --model "model-name"
"""

import mod as m
import sys

def query_with_free_model(query: str, use_venice: bool = False, model: str = None, stream: bool = True, max_tokens: int = 4096):
    """
    Query using a free model from OpenRouter or Venice.

    Args:
        query: The user's question/prompt
        use_venice: If True, use Venice AI instead of OpenRouter
        model: Optional specific model to use
        stream: Whether to stream the response
        max_tokens: Maximum tokens for response (default: 4096)

    Returns:
        str: The model's response
    """
    if use_venice:
        # Use Venice AI
        print("🌊 Using Venice AI...")
        venice = m.mod('venice')()

        if model is None:
            # Venice doesn't have a free_models() method, so we just use default
            print(f"📦 Using model: {venice.model}")
        else:
            print(f"📦 Using model: {model}")

        response = venice.forward(query, model=model, stream=stream, max_tokens=max_tokens)

        if stream:
            print("\n💬 Response:\n")
            full_response = ""
            for chunk in response:
                print(chunk, end='', flush=True)
                full_response += chunk
            print("\n")
            return full_response
        else:
            print(f"\n💬 Response:\n{response}\n")
            return response
    else:
        # Use OpenRouter with free model
        print("🔓 Using OpenRouter free model...")
        router = m.mod('openrouter')()

        # Get list of free models
        free_models = router.free_models()

        if not free_models:
            print("❌ No free models available. Fetching latest models...")
            free_models = router.free_models(update=True)

        if not free_models:
            raise ValueError("No free models found on OpenRouter. Check your connection.")

        # Use specified model or pick the first free one
        if model is None:
            selected_model = free_models[0]
            print(f"📦 Available free models: {len(free_models)}")
            print(f"📦 Using: {selected_model}")
        else:
            selected_model = model
            print(f"📦 Using: {selected_model}")

        # Query the model
        response = router.forward(query, model=selected_model, stream=stream, free=True if model is None else False, max_tokens=max_tokens)

        if stream:
            print("\n💬 Response:\n")
            full_response = ""
            for chunk in response:
                print(chunk, end='', flush=True)
                full_response += chunk
            print("\n")
            return full_response
        else:
            print(f"\n💬 Response:\n{response}\n")
            return response

def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Query free AI models')
    parser.add_argument('query', type=str, nargs='?', help='Your question or prompt')
    parser.add_argument('--venice', action='store_true', help='Use Venice AI instead of OpenRouter')
    parser.add_argument('--model', type=str, default=None, help='Specific model to use')
    parser.add_argument('--no-stream', action='store_true', help='Disable streaming')
    parser.add_argument('--list', action='store_true', help='List available free models')
    parser.add_argument('--max-tokens', type=int, default=4096, help='Maximum tokens for response (default: 4096)')

    args = parser.parse_args()

    # List free models
    if args.list:
        print("🔓 Fetching free models from OpenRouter...")
        router = m.mod('openrouter')()
        free_models = router.free_models(info=True)

        if free_models:
            print(f"\n📋 Found {len(free_models)} free models:\n")
            for model_info in free_models:
                print(f"  • {model_info['id']}")
                print(f"    Context: {model_info['context_length']:,} tokens")
                if model_info.get('name'):
                    print(f"    Name: {model_info['name']}")
                print()
        else:
            print("❌ No free models found.")
        return

    # Check if query is provided when not listing
    if not args.query:
        parser.error("query is required unless --list is used")
        return

    # Query the model
    try:
        response = query_with_free_model(
            args.query,
            use_venice=args.venice,
            model=args.model,
            stream=not args.no_stream,
            max_tokens=args.max_tokens
        )

        # Save to history (already done in forward method)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
