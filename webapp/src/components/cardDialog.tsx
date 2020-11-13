// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {FormattedMessage} from 'react-intl'

import {BoardTree} from '../viewModel/boardTree'
import mutator from '../mutator'
import Menu from '../widgets/menu'
import DeleteIcon from '../widgets/icons/delete'

import {MutableCardTree, CardTree} from '../viewModel/cardTree'
import {OctoListener} from '../octoListener'
import {Utils} from '../utils'

import Dialog from './dialog'
import CardDetail from './cardDetail'

type Props = {
    boardTree: BoardTree
    cardId: string
    onClose: () => void
    showCard: (cardId?: string) => void
}

type State = {
    cardTree?: CardTree
}

class CardDialog extends React.Component<Props, State> {
    state: State = {}

    private cardListener?: OctoListener

    shouldComponentUpdate(): boolean {
        return true
    }

    componentDidMount(): void {
        this.createCardTreeAndSync()
    }

    private async createCardTreeAndSync() {
        const cardTree = new MutableCardTree(this.props.cardId)
        await cardTree.sync()
        this.createListener()
        this.setState({cardTree})
        Utils.log(`cardDialog.createCardTreeAndSync: ${cardTree.card.id}`)
    }

    private createListener() {
        this.cardListener = new OctoListener()
        this.cardListener.open(
            [this.props.cardId],
            async (blocks) => {
                Utils.log(`cardListener.onChanged: ${blocks.length}`)
                const newCardTree = this.state.cardTree!.mutableCopy()
                if (newCardTree.incrementalUpdate(blocks)) {
                    this.setState({cardTree: newCardTree})
                }
            },
            async () => {
                Utils.log('cardListener.onReconnect')
                const newCardTree = this.state.cardTree!.mutableCopy()
                await newCardTree.sync()
                this.setState({cardTree: newCardTree})
            },
        )
    }

    componentWillUnmount(): void {
        this.cardListener?.close()
        this.cardListener = undefined
    }

    render(): JSX.Element {
        const {cardTree} = this.state

        const menu = (
            <Menu position='left'>
                <Menu.Text
                    id='delete'
                    icon={<DeleteIcon/>}
                    name='Delete'
                    onClick={async () => {
                        const card = this.state.cardTree?.card
                        if (!card) {
                            Utils.assertFailure()
                            return
                        }
                        await mutator.deleteBlock(card, 'delete card')
                        this.props.onClose()
                    }}
                />
                {(cardTree && !cardTree.card.isTemplate) &&
                    <Menu.Text
                        id='makeTemplate'
                        name='New template from card'
                        onClick={this.makeTemplate}
                    />
                }
            </Menu>
        )
        return (
            <Dialog
                onClose={this.props.onClose}
                toolsMenu={menu}
            >
                {(cardTree?.card.isTemplate) &&
                    <div className='banner'>
                        <FormattedMessage
                            id='CardDialog.editing-template'
                            defaultMessage="You're editing a template"
                        />
                    </div>
                }
                {this.state.cardTree &&
                    <CardDetail
                        boardTree={this.props.boardTree}
                        cardTree={this.state.cardTree}
                    />
                }
            </Dialog>
        )
    }

    private makeTemplate = async () => {
        const {cardTree} = this.state
        if (!cardTree) {
            Utils.assertFailure('this.state.cardTree')
            return
        }

        const newCardTree = cardTree.templateCopy()
        newCardTree.card.isTemplate = true
        newCardTree.card.title = 'New Template'

        Utils.log(`Created new template: ${newCardTree.card.id}`)

        const blocksToInsert = [newCardTree.card, ...newCardTree.contents]
        await mutator.insertBlocks(
            blocksToInsert,
            'create template from card',
            async () => {
                this.props.showCard(newCardTree.card.id)
            },
            async () => {
                this.props.showCard(undefined)
            },
        )
    }
}

export {CardDialog}
