/** Every API error body: a message, plus per-field messages on a 422. */
export interface ApiErrorBody {
    message: string;
    errors?: Record<string, string>;
}
