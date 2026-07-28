import { Injectable } from '@angular/core';
import { EloComputationInput, EloComputationResult } from './evnict.models';

@Injectable({
    providedIn: 'root'
})
export class EloService {
    private readonly defaultKFactor = 24;

    calculate(input: EloComputationInput): EloComputationResult {
        const homeExpected = this.expectedScore(input.homeElo, input.awayElo);
        const awayExpected = this.expectedScore(input.awayElo, input.homeElo);

        const homeActual = this.actualScore(input.homeScore, input.awayScore);
        const awayActual = this.actualScore(input.awayScore, input.homeScore);

        const k = input.settings?.kFactor ?? this.defaultKFactor;

        return {
            homeExpected,
            awayExpected,
            homeAfter: Math.round(input.homeElo + k * (homeActual - homeExpected)),
            awayAfter: Math.round(input.awayElo + k * (awayActual - awayExpected))
        };
    }

    private expectedScore(playerElo: number, opponentElo: number): number {
        return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    }

    private actualScore(playerScore: number, opponentScore: number): 1 | 0.5 | 0 {
        if (playerScore > opponentScore) {
            return 1;
        }

        if (playerScore === opponentScore) {
            return 0.5;
        }

        return 0;
    }
}
