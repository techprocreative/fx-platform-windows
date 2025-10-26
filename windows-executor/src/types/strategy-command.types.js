/**
 * Strategy Command Types
 * Commands for strategy lifecycle management
 */
export var StrategyCommandType;
(function (StrategyCommandType) {
    StrategyCommandType["START_STRATEGY"] = "START_STRATEGY";
    StrategyCommandType["STOP_STRATEGY"] = "STOP_STRATEGY";
    StrategyCommandType["PAUSE_STRATEGY"] = "PAUSE_STRATEGY";
    StrategyCommandType["RESUME_STRATEGY"] = "RESUME_STRATEGY";
    StrategyCommandType["UPDATE_STRATEGY"] = "UPDATE_STRATEGY";
})(StrategyCommandType || (StrategyCommandType = {}));
