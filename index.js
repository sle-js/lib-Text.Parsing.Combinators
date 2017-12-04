const Array = mrequire("core:Native.Data.Array:1.2.0");
const Maybe = mrequire("core:Native.Data.Maybe:1.0.0");
const Result = mrequire("core:Native.Data.Result:1.0.0");


const okayResult = lexer => result =>
    Result.Okay({lexer: lexer, result: result});


const errorResult = lexer => result =>
    Result.Error({lexer: lexer, result: result});


const mapResult = f => result =>
    result.map(r => ({lexer: r.lexer, result: f(r.result)}));


const hasBacktrackedOnLexer = lexer => otherLexer =>
    lexer.head().index() === otherLexer.head().index();


const hasBacktrackedOnLexerResult = lexer => otherResult =>
    hasBacktrackedOnLexer(lexer)(otherResult.content[1].lexer);


const hasBacktrackedOnResult = result => otherResult =>
    hasBacktrackedOnLexerResult(result.content[1].lexer)(otherResult);


const map = parser => f => lexer =>
    mapResult(f)(parser(lexer));


const andThen = currentResult => parser =>
    currentResult.andThen(s => mapResult(r => Array.append(r)(s.result))(parser(s.lexer)));


const and = parsers => lexer =>
    Array.foldl(okayResult(lexer)([]))(andThen)(parsers);


const andMap = parsers => f =>
    map(and(parsers))(f);


const manyResult = currentResult => parser => {
    const nextResult =
        andThen(currentResult)(parser);

    return nextResult.isOkay()
        ? manyResult(nextResult)(parser)
        : hasBacktrackedOnResult(currentResult)(nextResult)
            ? currentResult
            : nextResult;
};


const many = parser => lexer =>
    manyResult(okayResult(lexer)([]))(parser);


const or = errorFn => parsers => lexer => {
    const parseOption = parser => {
        const optionResult = parser(lexer);

        return optionResult.isOkay() || !hasBacktrackedOnLexerResult(lexer)(optionResult)
            ? Maybe.Just(optionResult)
            : Maybe.Nothing;
    };

    return Array.findMap(parseOption)(parsers).withDefault(errorResult(lexer.tail())(errorFn(lexer.head())));
};


const sepBy1 = parser => sep => lexer => {
    const initialResult =
        mapResult(r => [r])(parser(lexer));

    const tailParser =
        andMap([sep, parser])(a => a[1]);

    return initialResult.isOkay()
        ? manyResult(initialResult)(tailParser)
        : initialResult;
};


const chainl1Map = parser => sep => f =>
    map(sepBy1(parser)(sep))(f);


const condition = errorFn => f => lexer =>
    f(lexer.head())
        ? okayResult(lexer.tail())(lexer.head())
        : errorResult(lexer.tail())(errorFn(lexer.head()));


const token = errorFn => tokenID =>
    condition(errorFn)(h => h.token().id === tokenID);


const tokenMap = errorFn => tokenID => f =>
    map(token(errorFn)(tokenID))(f);


const optional = parser => lexer => {
    const result = parser(lexer);

    return result.isOkay()
        ? mapResult(Maybe.Just)(result)
        : hasBacktrackedOnLexerResult(lexer)(result)
            ? okayResult(lexer)(Maybe.Nothing)
            : result;
};


const optionalMap = parser => f =>
    map(optional(parser))(f);


const backtrack = parser => lexer => {
    const result = parser(lexer);

    return result.isOkay()
        ? result
        : result.mapError(error => ({lexer: lexer, result: error.result}));
};


module.exports = {
    and,
    andMap,
    backtrack,
    condition,
    sepBy1,
    chainl1Map,
    many,
    map,
    optional,
    optionalMap,
    or,
    token,
    tokenMap,
};