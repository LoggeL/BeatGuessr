/**
 * Timeline - Renders the player's timeline with position slots
 */
class Timeline {
    constructor(container) {
        this.container = container;
    }

    /**
     * Render the timeline for a player
     * @param {Player} player - The player whose timeline to render
     * @param {boolean} showSlots - Whether to show position slots for guessing
     * @param {number} selectedPosition - Currently selected position
     * @param {Function} onSlotClick - Callback when a slot is clicked
     */
    render(player, showSlots = false, selectedPosition = null, onSlotClick = null) {
        this.container.innerHTML = '';

        const cards = player.timeline;
        const options = player.getPositionOptions();

        if (cards.length === 0 && !showSlots) {
            this.container.innerHTML = `
                <div class="empty-timeline">
                    <p>Noch keine Karten</p>
                </div>
            `;
            return;
        }

        // Render alternating slots and cards
        // For N cards, we have N+1 position options (before first, between each pair, after last)
        cards.forEach((card, cardIndex) => {
            // Add slot before this card
            if (showSlots) {
                const slot = this.createSlot(options[cardIndex], selectedPosition === options[cardIndex].position, onSlotClick);
                this.container.appendChild(slot);

                const arrow = document.createElement('span');
                arrow.className = 'timeline-arrow';
                arrow.textContent = '→';
                this.container.appendChild(arrow);
            }

            // Add the card
            const cardElement = card.createElement(true);
            this.container.appendChild(cardElement);

            // Add arrow after card (except for last card when not showing slots)
            if (cardIndex < cards.length - 1 || showSlots) {
                const arrow = document.createElement('span');
                arrow.className = 'timeline-arrow';
                arrow.textContent = '→';
                this.container.appendChild(arrow);
            }
        });

        // Add final slot (after last card)
        if (showSlots && cards.length > 0) {
            const lastOption = options[options.length - 1];
            const slot = this.createSlot(lastOption, selectedPosition === lastOption.position, onSlotClick);
            this.container.appendChild(slot);
        }

        // Handle empty timeline with slots
        if (showSlots && cards.length === 0) {
            const slot = this.createSlot(options[0], selectedPosition === options[0].position, onSlotClick);
            this.container.appendChild(slot);
        }
    }

    /**
     * Create a position slot element
     */
    createSlot(option, isSelected, onClick) {
        const slot = document.createElement('div');
        slot.className = `position-slot ${isSelected ? 'selected' : ''}`;
        slot.dataset.position = option.position;
        slot.innerHTML = `<span class="slot-label">${option.label}</span>`;
        
        if (onClick) {
            slot.addEventListener('click', () => onClick(option.position));
        }

        return slot;
    }

    /**
     * Render a simple timeline (no slots) for display
     */
    renderSimple(cards) {
        this.container.innerHTML = '';

        if (cards.length === 0) {
            this.container.innerHTML = '<p class="text-muted">Keine Karten</p>';
            return;
        }

        cards.forEach((card, index) => {
            if (index > 0) {
                const arrow = document.createElement('span');
                arrow.className = 'timeline-arrow';
                arrow.textContent = '→';
                this.container.appendChild(arrow);
            }

            const cardElement = card.createElement(true);
            this.container.appendChild(cardElement);
        });
    }
}

// Export for use in other files
window.Timeline = Timeline;
