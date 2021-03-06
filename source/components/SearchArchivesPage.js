import React, { PureComponent } from "react";
import SearchBar from "react-native-search-bar";
import { StyleSheet, Text, View, ScrollView, Image } from "react-native";
import PropTypes from "prop-types";
import { CellInput, CellGroup, Cell } from "react-native-cell-components";
import debounce from "debounce";
import { withNamespaces } from "react-i18next";
import { searchUsingTerm, searchUsingURL, updateSearch } from "../shared/search.js";
import { getSharedArchiveManager } from "../library/buttercup.js";
import i18n from "../shared/i18n";
import SearchResult from "./SearchResult";
import EmptyView from "./EmptyView.js";
import { handleError } from "../global/exceptions.js";
import { doAsyncWork } from "../global/async.js";

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});

class SearchArchives extends PureComponent {
    static navigationOptions = {
        title: i18n.t("vaults.search")
    };

    static propTypes = {
        autofillURLs: PropTypes.arrayOf(PropTypes.string),
        currentSourceID: PropTypes.string,
        searchContext: PropTypes.oneOf(["root", "archive"]),
        onEntryPress: PropTypes.func.isRequired,
        onStatusChange: PropTypes.func.isRequired
    };

    focusSubscription = null;

    state = {
        autofillURLs: null,
        entries: [],
        searchTerm: "",
        selectedItemIndex: -1
    };

    vaultUpdate = null;

    changeInput = debounce(function(text) {
        this.updateVaults();
        this.setState(
            {
                searchTerm: text,
                selectedItemIndex: -1
            },
            () =>
                this.vaultUpdate
                    .then(() => doAsyncWork())
                    .then(() =>
                        this.state.searchTerm ? searchUsingTerm(this.state.searchTerm) : []
                    )
                    .then(entries => {
                        this.setState({ entries });
                    })
        );
    }, 250);

    checkAutofillURLs() {
        if (Array.isArray(this.props.autofillURLs) && this.state.autofillURLs === null) {
            this.setState({ autofillURLs: [...this.props.autofillURLs] }, () => {
                this.updateVaults()
                    .then(() =>
                        this.state.autofillURLs[0] ? searchUsingURL(this.state.autofillURLs[0]) : []
                    )
                    .then(entries => {
                        this.setState({ entries });
                    })
                    .catch(err => {
                        handleError("Failed preparing search", err);
                    });
            });
        }
    }

    componentDidUpdate() {
        this.checkAutofillURLs();
    }

    componentDidMount() {
        this.focusSubscription = this.props.navigation.addListener("didFocus", payload => {
            this.focus();
        });
        this.checkAutofillURLs();
    }

    componentWillUnmount() {
        this.focusSubscription.remove();
    }

    focus() {
        if (this._input) {
            this._input.focus();
        }
    }

    renderSearchResults() {
        return (
            <Choose>
                <When condition={this.state.entries.length > 0}>
                    <CellGroup>
                        <For each="result" of={this.state.entries}>
                            <SearchResult
                                key={result.entry.id}
                                sourceID={result.sourceID}
                                entryID={result.entry.id}
                                onEntryPress={this.props.onEntryPress}
                            />
                        </For>
                    </CellGroup>
                </When>
                <When condition={this.state.searchTerm.length > 0}>
                    <EmptyView text={this.props.t("search.no-results")} />
                </When>
                <Otherwise>
                    <EmptyView text={this.props.t("search.start-typing")} />
                </Otherwise>
            </Choose>
        );
    }

    render() {
        return (
            <View style={styles.container}>
                <SearchBar
                    ref={input => (this._input = input)}
                    barStyle="default"
                    placeholder={this.props.t("search.self")}
                    autoCapitalize="none"
                    keyboardType="default"
                    cancelButtonText={this.props.t("search.cancel")}
                    spellCheck={false}
                    tintColor="#454545"
                    onChangeText={text => this.changeInput(text)}
                />
                <ScrollView style={styles.container} keyboardShouldPersistTaps="never">
                    {this.renderSearchResults()}
                </ScrollView>
            </View>
        );
    }

    updateVaults() {
        if (!this.vaultUpdate) {
            this.props.onStatusChange("Preparing search");
            const vm = getSharedArchiveManager();
            const vaults =
                this.props.searchContext === "root"
                    ? vm.unlockedSources.map(source => source.vault)
                    : [vm.getSourceForID(this.props.currentSourceID).vault];
            this.vaultUpdate = updateSearch(vaults)
                .then(() => {
                    this.props.onStatusChange(null);
                })
                .catch(err => {
                    handleError("Search failed during preparation", err);
                    this.props.onStatusChange(null);
                });
        }
        return this.vaultUpdate;
    }
}

export default withNamespaces()(SearchArchives);
